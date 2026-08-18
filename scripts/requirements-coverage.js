#!/usr/bin/env node
/**
 * Requirement traceability & coverage (front-end of the coverage report).
 *
 * Reads requirements/*.md (the requirement catalogue), features/*.feature (which
 * scenarios carry @req:<ID> tags), and allure-results (each scenario's status),
 * then computes per requirement:
 *   covered  — a scenario tagged @req:<ID> exists and passed
 *   failing  — a scenario exists but none passed
 *   pending  — a scenario exists but hasn't run yet (no result)
 *   gap      — NO scenario references the requirement
 *
 * Emits: requirements-coverage.md (traceability matrix), Allure placeholder
 * results for gap/failing requirements (a "Requirement gaps" epic), a
 * criticality-ranked console summary, and the same summary into the GitHub job
 * summary when running in CI. Optional gate: REQ_FAIL_ON_GAP=1.
 *
 * Dep-free so CI runs it with no npm install.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQ_DIR = process.env.REQ_DIR || 'requirements';
const FEATURES_DIR = process.env.FEATURES_DIR || 'features';
const RESULTS_DIR = process.env.ALLURE_RESULTS_DIR || 'allure-results';
const MATRIX_OUT = process.env.REQ_MATRIX_OUT || 'requirements-coverage.md';
const SEV = { critical: 'critical', high: 'critical', normal: 'normal', low: 'minor' };
const PRI_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };
const STATE_ICON = { covered: '✅', failing: '⚠️', pending: '🟡', gap: '❌' };

// ── 1. Requirement catalogue from requirements/*.md ───────────────────────────
function loadRequirements() {
  if (!fs.existsSync(REQ_DIR)) return [];
  const reqs = [];
  for (const file of fs
    .readdirSync(REQ_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md')) {
    const text = fs.readFileSync(path.join(REQ_DIR, file), 'utf8');
    const fm = {};
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (m)
      for (const line of m[1].split('\n')) {
        const kv = line.match(/^([\w-]+):\s*(.+)$/);
        if (kv) fm[kv[1].trim()] = kv[2].trim();
      }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const h = lines[i].match(/^##\s+(REQ-[A-Z0-9]+-\d+)\s*[—:-]\s*(.+)$/);
      if (!h) continue;
      let priority = fm.priority || 'normal';
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const p = lines[j].match(/\*\*Priority:\*\*\s*(\w+)/i);
        if (p) {
          priority = p[1].toLowerCase();
          break;
        }
        if (/^##\s/.test(lines[j])) break;
      }
      reqs.push({ id: h[1], title: h[2].trim(), priority, epic: fm.epic || file, journey: fm.journey || '' });
    }
  }
  return reqs;
}

// ── 2. Which scenarios reference each requirement (@req:<ID>) ─────────────────
function loadFeatureRefs() {
  const byReq = {}; // req id -> [scenario names]
  if (!fs.existsSync(FEATURES_DIR)) return byReq;
  for (const file of fs.readdirSync(FEATURES_DIR).filter((f) => f.endsWith('.feature'))) {
    const lines = fs.readFileSync(path.join(FEATURES_DIR, file), 'utf8').split('\n');
    let pending = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('@')) {
        for (const t of line.split(/\s+/)) {
          const r = t.match(/^@req:(REQ-[A-Z0-9]+-\d+)$/);
          if (r) pending.push(r[1]);
        }
      } else if (/^Scenario(\s+Outline)?:/.test(line)) {
        const name = line.replace(/^Scenario(\s+Outline)?:\s*/, '');
        for (const id of pending) (byReq[id] = byReq[id] || []).push(name);
        pending = [];
      } else if (line && !line.startsWith('#')) {
        pending = []; // tags only attach to the next scenario
      }
    }
  }
  return byReq;
}

// ── 3. Test status per requirement from allure-results (req:<ID> tag labels) ──
function loadResultStatus() {
  const byReq = {}; // req id -> {passed, failed}
  if (!fs.existsSync(RESULTS_DIR)) return byReq;
  for (const f of fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('-result.json'))) {
    let r;
    try {
      r = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
    } catch {
      continue;
    }
    const reqTags = (r.labels || [])
      .filter((l) => l.name === 'tag' && l.value.startsWith('req:'))
      .map((l) => l.value.slice(4));
    for (const id of reqTags) {
      const s = (byReq[id] = byReq[id] || { passed: 0, failed: 0 });
      if (r.status === 'passed') s.passed++;
      else if (r.status === 'failed' || r.status === 'broken') s.failed++;
    }
  }
  return byReq;
}

function main() {
  const reqs = loadRequirements();
  const refs = loadFeatureRefs();
  const status = loadResultStatus();

  const rows = reqs.map((req) => {
    const scenarios = refs[req.id] || [];
    const st = status[req.id];
    let state;
    if (scenarios.length === 0) state = 'gap';
    else if (st && st.passed > 0) state = 'covered';
    else if (st && st.failed > 0) state = 'failing';
    else state = 'pending';
    return { ...req, scenarios, state };
  });

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Allure placeholders for gaps / failing requirements
  for (const r of rows.filter((r) => r.state === 'gap' || r.state === 'failing')) {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    fs.writeFileSync(
      path.join(RESULTS_DIR, `${uuid}-result.json`),
      JSON.stringify({
        uuid,
        historyId: crypto
          .createHash('md5')
          .update('req:' + r.id)
          .digest('hex'),
        name: `${r.state === 'gap' ? 'Uncovered requirement' : 'Failing requirement'}: ${r.id} — ${r.title}`,
        fullName: `requirements.${r.state}.${r.id}`,
        status: r.state === 'gap' ? 'skipped' : 'broken',
        statusDetails: {
          message:
            r.state === 'gap'
              ? `No scenario is tagged @req:${r.id} ("${r.title}")`
              : `Requirement ${r.id} has scenario(s) but none passing`,
        },
        stage: 'finished',
        start: now,
        stop: now,
        labels: [
          { name: 'epic', value: 'Requirement gaps' },
          { name: 'feature', value: r.epic },
          { name: 'severity', value: SEV[r.priority] || 'normal' },
          { name: 'tag', value: 'requirement-gap' },
          { name: 'requirement', value: r.id },
          { name: 'suite', value: 'Requirement gaps' },
        ],
      }),
    );
  }

  // Traceability matrix
  const total = rows.length;
  const covered = rows.filter((r) => r.state === 'covered').length;
  const pct = total ? Math.round((covered / total) * 100) : 0;
  let md = `# Requirement traceability\n\n**${covered}/${total} requirements covered (${pct}%)** — generated ${new Date().toISOString()}\n\n`;
  md += `| Requirement | Title | Priority | Scenarios | Status |\n|---|---|---|---|---|\n`;
  const ranked = [...rows].sort(
    (a, b) =>
      (a.state === 'covered' ? 1 : 0) - (b.state === 'covered' ? 1 : 0) ||
      (PRI_ORDER[a.priority] ?? 9) - (PRI_ORDER[b.priority] ?? 9),
  );
  for (const r of ranked) {
    md += `| \`${r.id}\` | ${r.title} | ${r.priority} | ${r.scenarios.map((s) => `"${s}"`).join('<br>') || '—'} | ${STATE_ICON[r.state]} ${r.state} |\n`;
  }
  fs.writeFileSync(MATRIX_OUT, md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');

  console.log(`\nRequirement coverage: ${covered}/${total} (${pct}%)`);
  for (const r of ranked) {
    console.log(`  ${STATE_ICON[r.state]} ${r.state.padEnd(8)} ${r.id} [${r.priority}] — ${r.title}`);
  }
  console.log(`\nMatrix written to ${MATRIX_OUT}`);

  if (process.env.REQ_FAIL_ON_GAP === '1') {
    const bad = rows.filter(
      (r) => (r.state === 'gap' || r.state === 'failing') && (r.priority === 'critical' || r.priority === 'high'),
    );
    if (bad.length) {
      console.error(`\nrequirement gate: ${bad.length} critical/high requirement(s) uncovered or failing`);
      process.exit(1);
    }
  }
}
main();
