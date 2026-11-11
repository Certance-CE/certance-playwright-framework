#!/usr/bin/env node
/**
 * `npm run triage` — classify every failure before anything touches it (Governed Loop stage 07).
 *
 * Reads the run's results (test-results/results.json, Playwright's JSON reporter) and puts each
 * failed or flaky test in one class:
 *
 *   product      the application did not do what the requirement says: a FINDING, reported as
 *                prominently as a green run, and never "fixed" by changing the test
 *   test         the test cannot reach the application: a locator that matches nothing or
 *                several elements. The ONLY class the healer may act on
 *   environment  the application, network or session was unavailable: rerun, do not edit
 *   flake        failed, then passed on retry: investigate; it already fails the build
 *   unclassified none of the evidence decided it: a person looks
 *
 * The rules read the failure text Playwright writes, and were built from real failures planted
 * for the purpose (unit/fixtures/triage/). Where the evidence decides the class, confidence is
 * high; where two readings remain (a control that is gone: drifted locator, or removed by the
 * product?), confidence is medium and the reason says what else it could be.
 *
 * Fail-safe by design: every ambiguous case falls AWAY from `test`, because `test` is the only
 * class that permits an automated change. A wrong guess can stop a fix, never weaken a test.
 *
 * Writes test-results/triage.json and triage.md (also a global attachment in the quality
 * report). Report-only: it never changes the build's result.
 */
const fs = require('node:fs');
const path = require('node:path');

// Stryker disable next-line all: where the files live is configuration, exercised by the CI step.
const ROOT = path.join(__dirname, '..');
// Stryker disable next-line all
const RESULTS = process.env.TRIAGE_RESULTS || path.join(ROOT, 'test-results/results.json');
// Stryker disable next-line all
const OUT_JSON = process.env.TRIAGE_JSON || path.join(ROOT, 'test-results/triage.json');
// Stryker disable next-line all
const OUT_MD = process.env.TRIAGE_MD || path.join(ROOT, 'triage.md');

const clean = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '');
const received = (m) => (m.match(/^\s*Received:\s*(.+)$/m) || [])[1]?.trim();

/**
 * The rules, in order; the first that matches decides. Each returns [class, confidence, reason].
 */
const RULES = [
  // Environment: nothing in the test or the product decided this.
  [
    (m) =>
      /net::ERR_(CONNECTION_REFUSED|CONNECTION_RESET|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|ADDRESS_UNREACHABLE|TIMED_OUT|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED)|\bECONNREFUSED\b|\bENOTFOUND\b|\bEAI_AGAIN\b|config\.webServer was not able to start/.test(
        m,
      ),
    'environment',
    'high',
    'the application or the network was not reachable',
  ],
  [
    (m) => received(m) === '429' || /Too Many Requests/i.test(m),
    'environment',
    'high',
    "the application's rate limit refused the request",
  ],
  [
    (m) => /^(401|403)$/.test(received(m) || '') && /token|session|expired|unauthori[sz]ed/i.test(m),
    'environment',
    'medium',
    'the session or token was rejected (or, less likely, an access-control defect: check before rerunning)',
  ],
  [
    (m) => /page\.(goto|reload|waitForURL|waitForLoadState): Timeout \d+ms exceeded/.test(m),
    'environment',
    'medium',
    'the application did not finish loading in time (or a slow page: check its performance)',
  ],
  // Test defects: the test cannot reach the application's control.
  [
    (m) => /strict mode violation: .+ resolved to \d+ elements/.test(m),
    'test',
    'high',
    'the locator matches more than one element',
  ],
  [
    (m) =>
      /element\(s\) not found/.test(m) ||
      (/Timeout \d+ms exceeded/.test(m) && /waiting for (getBy|locator)/.test(m) && !received(m)),
    'test',
    'medium',
    'the locator matches nothing (drifted locator, or the product removed the control: confirm which before healing)',
  ],
  // Product defects: the application answered, and the answer was wrong.
  [(m) => /API contract drift/.test(m), 'product', 'high', "the API's response no longer matches its contract"],
  [(m) => /^5\d\d$/.test(received(m) || ''), 'product', 'medium', 'the application answered with a server error'],
  [
    (m) => /^\s*Expected[^:]*:/m.test(m) && /^\s*Received[^:]*:/m.test(m),
    'product',
    'medium',
    'the application did something other than what the test expects. A person decides whether the product or the expectation is wrong; it is never healed',
  ],
];

/** Classify one failed or flaky test: { class, confidence, reason, evidence, healable }. */
function classify({ status, results = [] }) {
  const message = clean(results.find((r) => r.error)?.error?.message);
  const evidence = message.split('\n').find((l) => l.trim()) || '';
  if (status === 'flaky') {
    return { class: 'flake', confidence: 'high', reason: 'failed, then passed on retry', evidence, healable: false };
  }
  for (const [test, cls, confidence, reason] of RULES) {
    if (test(message)) return { class: cls, confidence, reason, evidence, healable: cls === 'test' };
  }
  return {
    class: 'unclassified',
    confidence: 'low',
    reason: 'no rule decided it; a person looks',
    evidence,
    healable: false,
  };
}

/** Every failed or flaky test in a Playwright JSON report, classified. */
function triage(report) {
  const out = [];
  const walk = (suite, trail) => {
    for (const child of suite.suites || []) walk(child, [...trail, child.title]);
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        if (t.status !== 'unexpected' && t.status !== 'flaky') continue;
        out.push({
          title: [...trail, spec.title].filter(Boolean).join(' › '),
          file: spec.file,
          project: t.projectName,
          ...classify(t),
        });
      }
    }
  };
  for (const s of report.suites || []) walk(s, [s.title]);
  return out;
}

const ORDER = ['product', 'test', 'environment', 'flake', 'unclassified'];
const HEADING = {
  product: '🔎 Findings: product defects the suite caught',
  test: '🔧 Test defects: the only failures the healer may act on',
  environment: '🌐 Environment: rerun, do not edit',
  flake: '🎲 Flakes: passed on retry, and already fail the build',
  unclassified: '❓ Unclassified: a person looks',
};

function render(items) {
  const count = (c) => items.filter((i) => i.class === c).length;
  let md = '# Failure triage\n\n';
  if (!items.length) return md + '**No failures to triage.** Every test passed on its first attempt.\n';
  md += `**${items.length} failure(s):** ${ORDER.filter(count)
    .map((c) => `${count(c)} ${c}`)
    .join(', ')}. Classified before anything was touched; only test defects are eligible for the healer.\n`;
  for (const c of ORDER) {
    const group = items.filter((i) => i.class === c);
    if (!group.length) continue;
    md += `\n## ${HEADING[c]}\n\n| Test | Confidence | Why | Evidence |\n|---|---|---|---|\n`;
    for (const i of group) {
      const ev = i.evidence.replace(/\|/g, '\\|').slice(0, 140);
      md += `| ${i.title.replace(/\|/g, '\\|')} | ${i.confidence} | ${i.reason} | \`${ev}\` |\n`;
    }
  }
  return md;
}

// Stryker disable all: file I/O, exercised by the CI step; the logic above is unit-tested.
function main() {
  if (!fs.existsSync(RESULTS)) {
    console.log(`triage: no results at ${path.relative(ROOT, RESULTS)}; run the suite first.`);
    return;
  }
  const items = triage(JSON.parse(fs.readFileSync(RESULTS, 'utf8')));
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(items, null, 2) + '\n');
  const md = render(items);
  fs.writeFileSync(OUT_MD, md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  console.log(md);
}

// Stryker restore all

module.exports = { classify, triage, render };

if (require.main === module) main();
