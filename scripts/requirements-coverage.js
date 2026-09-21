#!/usr/bin/env node
/**
 * Requirement traceability & coverage (front-end of the coverage report).
 *
 * Reads requirements/*.md (the catalogue), features/*.feature (which scenarios
 * carry @req:<ID> tags and what steps they run), the step definitions and Page
 * Objects those steps resolve to, and allure-results (each test's status this
 * run), then grades every requirement:
 *
 *   covered     a scenario tagged @req:<ID> passed, AND its bound steps assert
 *               something — directly, or one hop away in a Page Object method
 *   structural  a scenario passed, but nothing in the bound steps asserts:
 *               a green test that proves nothing (the "False Signal")
 *   failing     a scenario exists, a result exists, none passed
 *   pending     a scenario exists but produced no result this run (e.g. muted)
 *   gap         NO scenario references the requirement
 *
 * The governing rule: coverage may never look better than the evidence supports.
 * `structural` and `pending` are the two states a muted or empty test collapses
 * into, and the gate fails on both, so muting or emptying a test can no longer be
 * cheaper than fixing it. The assertion check is a FLOOR: an unbindable step or an
 * unrecognised assertion understates (grades weaker), never overstates — a
 * requirement covered only by a plain spec (an allure label, no bound steps) stays
 * `covered`, because there is nothing here to prove it does not assert.
 *
 * Emits: requirements-coverage.md (traceability matrix), Allure placeholders for
 * gap / failing / structural requirements, a criticality-ranked console summary,
 * and the same into the GitHub job summary in CI. Optional gate: REQ_FAIL_ON_GAP=1
 * fails the build on any critical/high requirement that is not `covered`.
 *
 * Dep-free so CI runs it with no npm install.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQ_DIR = process.env.REQ_DIR || 'requirements';
const FEATURES_DIR = process.env.FEATURES_DIR || 'features';
const STEPS_DIR = process.env.STEPS_DIR || path.join(FEATURES_DIR, 'step-definitions');
const PAGES_DIR = process.env.PAGES_DIR || 'pages';
const RESULTS_DIR = process.env.ALLURE_RESULTS_DIR || 'allure-results';
const MATRIX_OUT = process.env.REQ_MATRIX_OUT || 'requirements-coverage.md';
const SEV = { critical: 'critical', high: 'critical', normal: 'normal', low: 'minor' };
const PRI_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };
const STATE_ICON = { covered: '✅', structural: '🟠', failing: '⚠️', pending: '🟡', gap: '❌' };

// ── Assertion floor ──────────────────────────────────────────────────────────
// Does a scenario actually assert anything? Bind its Gherkin steps to their step
// definitions, follow one call into a Page Object method, and look for an
// assertion. Everything here understates rather than overstates: an unbindable
// step or an unrecognised assertion makes the grade weaker, never stronger.

// Assertion-shaped calls. Includes page-object `assert*()` methods and Playwright
// matchers, not only literal `expect(`, because the golden rules put assertions in
// Page Objects — a floor that only saw a step body's `expect(` would grade the
// framework's own correct architecture as structural.
const ASSERTION =
  /\bexpect\s*\(|\bassert\w*\s*\(|\.(?:toBe|toEqual|toContain|toMatch|toThrow|toBeVisible|toBeHidden|toBeChecked|toBeEnabled|toBeDisabled|toBeTruthy|toBeFalsy|toHave\w+|toContainText)\b/;

// Strip comments before reading a body, so a commented-out `expect(` cannot lift a
// grade. Block comments go entirely; a line comment goes when its `//` starts a line
// or follows whitespace, which leaves `http://`-style tokens intact.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function hasAssertion(bodies) {
  return bodies.some((b) => ASSERTION.test(b));
}

// Turn a step-def pattern (regex literal or Cucumber-expression string) into a
// predicate over keyword-stripped Gherkin step text.
function patternToTest(raw) {
  if (raw.startsWith('/')) {
    const last = raw.lastIndexOf('/');
    try {
      const re = new RegExp(raw.slice(1, last), raw.slice(last + 1).replace(/[^gimsuy]/g, ''));
      return (t) => re.test(t);
    } catch {
      return () => false;
    }
  }
  const literal = raw.slice(1, -1); // strip the surrounding quotes
  const source =
    '^' +
    literal
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{(?:string|word|int|float|bigint|double|)\\\}/g, (t) =>
        /string/.test(t) ? '(?:"[^"]*"|\'[^\']*\')' : /int|bigint/.test(t) ? '-?\\d+' : /float|double/.test(t) ? '-?[\\d.]+' : '\\S+',
      )
      .replace(/\\\{\\\}/g, '.*') +
    '$';
  try {
    const re = new RegExp(source);
    return (t) => re.test(t);
  } catch {
    return () => false;
  }
}

function walkFiles(dir) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|js|mjs)$/.test(e.name)) files.push(p);
    }
  };
  if (dir && fs.existsSync(dir)) walk(dir);
  return files;
}

// Step definitions in STEPS_DIR: [{ matcher, body }], comments stripped.
function loadStepDefs(dir) {
  const defs = [];
  const KW = /(?:Given|When|Then|And|But|Step|defineStep)\(\s*(\/[^/]+\/[a-z]*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
  for (const file of walkFiles(dir)) {
    const text = fs.readFileSync(file, 'utf8');
    const marks = [];
    let m;
    while ((m = KW.exec(text))) marks.push({ index: m.index, raw: m[1] });
    for (let i = 0; i < marks.length; i++) {
      const body = text.slice(marks[i].index, i + 1 < marks.length ? marks[i + 1].index : text.length);
      defs.push({ matcher: patternToTest(marks[i].raw), body: stripComments(body) });
    }
  }
  return defs;
}

// Page Object methods in PAGES_DIR: Map(name -> body), comments stripped. Used for
// the single hop from a step into the method it calls.
function loadPageMethods(dir) {
  const methods = new Map();
  const SKIP = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'await', 'constructor']);
  const SIG = /(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*{/g;
  for (const file of walkFiles(dir)) {
    const text = stripComments(fs.readFileSync(file, 'utf8'));
    let m;
    while ((m = SIG.exec(text))) {
      const name = m[1];
      if (SKIP.has(name)) continue;
      let depth = 1;
      let i = SIG.lastIndex;
      for (; i < text.length && depth > 0; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
      }
      const body = text.slice(SIG.lastIndex, i - 1);
      methods.set(name, methods.has(name) ? methods.get(name) + '\n' + body : body);
      SIG.lastIndex = i; // resume after this method, not inside it
    }
  }
  return methods;
}

// The union of step-def bodies bound to a scenario's steps, PLUS the body of any
// Page Object method those steps call (one hop). Empty when nothing binds — which
// the caller reads as "cannot prove absence of assertion", never as structural.
function boundBodies(scenarios, defs, pageMethods) {
  const bodies = new Set();
  for (const sc of scenarios) for (const step of sc.steps) for (const d of defs) if (d.matcher(step)) bodies.add(d.body);
  const called = new Set();
  for (const b of bodies) {
    let m;
    const re = /\.([A-Za-z_$][\w$]*)\s*\(/g;
    while ((m = re.exec(b))) called.add(m[1]);
  }
  for (const name of called) if (pageMethods.has(name)) bodies.add(pageMethods.get(name));
  return [...bodies];
}

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

// ── 2. Scenarios (with their steps) referencing each requirement (@req:<ID>) ──
function loadScenarios(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.feature'))) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    let tags = [];
    let cur = null;
    const flush = () => {
      if (cur) out.push(cur);
      cur = null;
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('@')) {
        tags.push(...line.split(/\s+/).filter((t) => t.startsWith('@')));
      } else if (/^Scenario(\s+Outline)?:/.test(line)) {
        flush();
        const name = line.replace(/^Scenario(\s+Outline)?:\s*/, '');
        const reqTags = tags.map((t) => (t.match(/^@req:(REQ-[A-Z0-9]+-\d+)$/) || [])[1]).filter(Boolean);
        cur = { name, reqTags, steps: [] };
        tags = [];
      } else if (/^(Given|When|Then|And|But)\s+/.test(line) && cur) {
        cur.steps.push(line.replace(/^(Given|When|Then|And|But)\s+/, ''));
      } else if (line && !line.startsWith('#') && !line.startsWith('|') && !/^(Feature|Background|Examples|Rule)/.test(line)) {
        if (!cur) tags = []; // stray line before any scenario: tags do not carry over
      }
    }
    flush();
  }
  return out;
}

function loadFeatureRefs() {
  const byReq = {}; // req id -> [{ name, steps }]
  for (const sc of loadScenarios(FEATURES_DIR)) {
    for (const id of sc.reqTags) (byReq[id] = byReq[id] || []).push({ name: sc.name, steps: sc.steps });
  }
  return byReq;
}

// ── 3. Test status per requirement from allure-results (req:<ID> tag labels) ──
function loadResultStatus() {
  const byReq = {}; // req id -> {passed, failed, names:Set}
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
      const s = (byReq[id] = byReq[id] || { passed: 0, failed: 0, names: new Set() });
      // Record the test's own name so a requirement covered by a plain spec — an API
      // test, say — still shows WHAT covers it, not just that something does.
      if (r.name) s.names.add(r.name);
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
  const defs = loadStepDefs(STEPS_DIR);
  const pageMethods = loadPageMethods(PAGES_DIR);

  const rows = reqs.map((req) => {
    const st = status[req.id];
    // BDD scenarios come from .feature files (with their steps); anything else — a
    // plain Playwright spec, an API test — is found by the requirement label it
    // reported. Without the second source a requirement covered outside BDD reads as
    // a gap, which would make the matrix lie about the very lanes it traces.
    const featScenarios = refs[req.id] || [];
    const scenarios = featScenarios.length ? featScenarios.map((s) => s.name) : [...(st?.names ?? [])];
    let state;
    if (scenarios.length === 0) state = 'gap';
    else if (st && st.passed > 0) {
      // Passed — but is there an assertion behind the pass? Only downgrade when we
      // could actually bind the steps; a plain-spec label (no bound steps) stays covered.
      const bodies = boundBodies(featScenarios, defs, pageMethods);
      state = bodies.length && !hasAssertion(bodies) ? 'structural' : 'covered';
    } else if (st && st.failed > 0) state = 'failing';
    else state = 'pending';
    return { ...req, scenarios, state };
  });

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Allure placeholders for anything not covered and not merely un-run, so a gap, a
  // failing requirement, or a green-but-assertionless one all surface in the report.
  const LABEL = { gap: 'Uncovered', failing: 'Failing', structural: 'Structural-only' };
  for (const r of rows.filter((r) => r.state === 'gap' || r.state === 'failing' || r.state === 'structural')) {
    const now = Date.now();
    const uuid = crypto.randomUUID();
    fs.writeFileSync(
      path.join(RESULTS_DIR, `${uuid}-result.json`),
      JSON.stringify({
        uuid,
        historyId: crypto
          .createHash('sha256')
          .update('req:' + r.id)
          .digest('hex'),
        name: `${LABEL[r.state]} requirement: ${r.id} — ${r.title}`,
        fullName: `requirements.${r.state}.${r.id}`,
        status: r.state === 'gap' ? 'skipped' : 'broken',
        statusDetails: {
          message:
            r.state === 'gap'
              ? `No scenario is tagged @req:${r.id} ("${r.title}")`
              : r.state === 'failing'
                ? `Requirement ${r.id} has scenario(s) but none passing`
                : `Requirement ${r.id} passed, but the bound steps assert nothing`,
        },
        stage: 'finished',
        start: now,
        stop: now,
        labels: [
          { name: 'epic', value: 'Requirement coverage' },
          { name: 'feature', value: r.epic },
          { name: 'severity', value: SEV[r.priority] || 'normal' },
          { name: 'tag', value: `req-${r.state}` },
          { name: 'requirement', value: r.id },
          { name: 'suite', value: 'Requirement coverage' },
        ],
      }),
    );
  }

  // Traceability matrix
  const total = rows.length;
  const covered = rows.filter((r) => r.state === 'covered').length;
  const pct = total ? Math.round((covered / total) * 100) : 0;
  let md = `# Requirement traceability\n\n**${covered}/${total} requirements covered (${pct}%)** — generated ${new Date().toISOString()}\n\n`;
  md += `_Covered means a tagged scenario passed AND its bound steps assert something. A pass with no assertion is \`structural\`, not covered._\n\n`;
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
    console.log(`  ${STATE_ICON[r.state]} ${r.state.padEnd(10)} ${r.id} [${r.priority}] — ${r.title}`);
  }
  console.log(`\nMatrix written to ${MATRIX_OUT}`);

  // Gate: a critical/high requirement must be `covered` (passed AND asserting). A
  // gap, a failing test, a never-run (pending) or a green-but-empty (structural)
  // one all fail — muting a test can no longer sneak a requirement past the gate.
  if (process.env.REQ_FAIL_ON_GAP === '1') {
    const bad = rows.filter((r) => (r.priority === 'critical' || r.priority === 'high') && r.state !== 'covered');
    if (bad.length) {
      console.error(`\nrequirement gate: ${bad.length} critical/high requirement(s) not covered:`);
      for (const r of bad) console.error(`  ${STATE_ICON[r.state]} ${r.state} ${r.id} — ${r.title}`);
      process.exit(1);
    }
  }
}
main();
