#!/usr/bin/env node
/**
 * Performance report — a dedicated, at-a-glance view of the perf budgets.
 *
 * Reads perf-results/*.json (written by the `perf` fixture) and renders a single
 * table: each measured journey with its Core Web Vitals, engine processing time,
 * and whether it is within budget. Emits performance-report.md and, in CI, the
 * same table into the GitHub Actions run summary.
 *
 * This is the "separate performance view" — distinct from the functional Allure
 * report (which also gets a filterable "Performance" epic from the fixture).
 *
 * Gate a pipeline on it with PERF_FAIL_ON_BUDGET=1.
 *
 * Dep-free (mirrors scripts/ctrf-summary.js) so CI runs it with no npm install.
 */
const fs = require('fs');
const path = require('path');

const DIR = process.env.PERF_RESULTS_DIR || 'perf-results';
const OUT = process.env.PERF_REPORT_OUT || 'performance-report.md';

const fmt = (v, unit = '') => (v === null || v === undefined ? '—' : `${v}${unit}`);

function load() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function main() {
  const records = load();
  let md = `# Performance report\n\n`;

  if (records.length === 0) {
    md += `_No performance results found in \`${DIR}/\`. Run \`npm run test:perf\` first._\n`;
    fs.writeFileSync(OUT, md);
    console.log(md);
    return;
  }

  const overBudget = records.filter((r) => (r.violations || []).length > 0);
  md += `**${records.length - overBudget.length}/${records.length} journeys within budget** — generated ${new Date().toISOString()}\n\n`;
  md += `| Journey | LCP | CLS | INP | TTFB | Script | Heap | Budget |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;

  for (const r of records) {
    const m = r.metrics || {};
    const ok = (r.violations || []).length === 0;
    const status = ok ? '✅ within' : `❌ ${r.violations.map((v) => `${v.metric} ${v.value}>${v.limit}`).join(', ')}`;
    md += `| ${r.name} | ${fmt(m.lcp && Math.round(m.lcp), 'ms')} | ${fmt(m.cls)} | ${fmt(m.inp && Math.round(m.inp), 'ms')} | ${fmt(m.ttfb && Math.round(m.ttfb), 'ms')} | ${fmt(m.scriptMs, 'ms')} | ${fmt(m.jsHeapMB, 'MB')} | ${status} |\n`;
  }

  md += `\n_LCP/CLS/INP = Core Web Vitals · Script/Heap = main-thread engine work (CDP). INP is only measured when a test drives an interaction._\n`;

  fs.writeFileSync(OUT, md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');

  console.log(md);
  console.log(`Report written to ${OUT}`);

  if (process.env.PERF_FAIL_ON_BUDGET === '1' && overBudget.length > 0) {
    console.error(`\nperf gate: ${overBudget.length} journey(s) over budget`);
    process.exit(1);
  }
}

main();
