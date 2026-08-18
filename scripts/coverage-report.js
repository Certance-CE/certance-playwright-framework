#!/usr/bin/env node
/**
 * Coverage gap report (Layer 3 of the Allure coverage report).
 *
 * Reads test-data/coverage-seed.yaml (the journey baseline) + allure-results
 * (labelled by fixtures/allure.fixture.ts), then:
 *   - computes covered / failing / gap per journey,
 *   - emits placeholder Allure results for gaps + failing journeys so they show
 *     in the Behaviors tree and as slices in the status graph,
 *   - writes allure-results/coverage-summary.json,
 *   - prints a criticality-ranked console summary.
 *
 * Dep-free: uses js-yaml if installed, else a minimal parser for the documented
 * seed format — so CI can run it without an npm install.
 *
 * Optional gate: COVERAGE_FAIL_ON_CRITICAL_GAP=1 exits non-zero if a
 * critical/high journey is uncovered.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RESULTS_DIR = process.env.ALLURE_RESULTS_DIR || 'allure-results';
const SEED_PATH = process.env.COVERAGE_SEED || 'test-data/coverage-seed.yaml';
const SEV = { critical: 'critical', high: 'critical', normal: 'normal', low: 'minor' };
const CRIT_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };

function parseSeed(text) {
  try {
    return require('js-yaml').load(text).journeys || [];
  } catch {
    /* dep-free fallback */
  }
  const journeys = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    if (/^\s*#/.test(raw) || !raw.trim()) continue;
    let m;
    if ((m = raw.match(/^\s*-\s+key:\s*(.+)$/))) {
      cur = { key: m[1].trim(), features: [] };
      journeys.push(cur);
    } else if (cur && (m = raw.match(/^\s+features:\s*\[(.*)\]\s*$/))) {
      cur.features = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (cur && (m = raw.match(/^\s+(name|criticality|description):\s*(.+)$/))) {
      cur[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return journeys;
}

function loadResults() {
  if (!fs.existsSync(RESULTS_DIR)) return [];
  return fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('-result.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
const tagsOf = (r) => (r.labels || []).filter((l) => l.name === 'tag').map((l) => l.value);

function main() {
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`coverage: seed not found at ${SEED_PATH}`);
    return;
  }
  const journeys = parseSeed(fs.readFileSync(SEED_PATH, 'utf8'));
  const results = loadResults();

  const rows = journeys.map((j) => {
    const feats = new Set(j.features || []);
    const tests = results.filter((r) => tagsOf(r).some((t) => feats.has(t)));
    const passed = tests.filter((r) => r.status === 'passed').length;
    const failed = tests.filter((r) => r.status === 'failed' || r.status === 'broken').length;
    const state = tests.length === 0 ? 'gap' : passed === 0 ? 'failing' : 'covered';
    return { ...j, tests: tests.length, passed, failed, state };
  });

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  for (const r of rows.filter((r) => r.state !== 'covered')) {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    fs.writeFileSync(
      path.join(RESULTS_DIR, `${uuid}-result.json`),
      JSON.stringify({
        uuid,
        historyId: crypto
          .createHash('md5')
          .update('journey:' + r.key)
          .digest('hex'),
        name: `${r.state === 'gap' ? 'Coverage gap' : 'Coverage failing'}: ${r.name}`,
        fullName: `coverage.${r.state}.${r.key}`,
        status: r.state === 'gap' ? 'skipped' : 'broken',
        statusDetails: {
          message:
            r.state === 'gap'
              ? `No test covers journey "${r.name}" (features: ${(r.features || []).join(', ')})`
              : `Journey "${r.name}" has ${r.tests} test(s) but none passing (${r.failed} failing)`,
        },
        stage: 'finished',
        start: now,
        stop: now,
        labels: [
          { name: 'epic', value: 'Coverage gaps' },
          { name: 'feature', value: r.name },
          { name: 'severity', value: SEV[r.criticality] || 'normal' },
          { name: 'tag', value: 'coverage-gap' },
          { name: 'suite', value: 'Coverage gaps' },
        ],
      }),
    );
  }

  const total = rows.length;
  const covered = rows.filter((r) => r.state === 'covered').length;
  const pct = total ? Math.round((covered / total) * 100) : 0;
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'coverage-summary.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), total, covered, coveragePct: pct, journeys: rows },
      null,
      2,
    ),
  );

  const ranked = [...rows].sort(
    (a, b) =>
      (a.state === 'covered' ? 1 : 0) - (b.state === 'covered' ? 1 : 0) ||
      (CRIT_ORDER[a.criticality] ?? 9) - (CRIT_ORDER[b.criticality] ?? 9),
  );
  console.log(`\nJourney coverage: ${covered}/${total} (${pct}%)`);
  for (const r of ranked) {
    const icon = r.state === 'covered' ? '  ✓' : r.state === 'gap' ? '  ✗ GAP    ' : '  ⚠ FAILING';
    console.log(`${icon}  ${r.name} [${r.criticality}] — ${r.passed}/${r.tests} passing`);
  }

  if (process.env.COVERAGE_FAIL_ON_CRITICAL_GAP === '1') {
    const crit = rows.filter(
      (r) => r.state !== 'covered' && (r.criticality === 'critical' || r.criticality === 'high'),
    );
    if (crit.length) {
      console.error(`\ncoverage gate: ${crit.length} critical/high journey(s) not covered`);
      process.exit(1);
    }
  }
}
main();
