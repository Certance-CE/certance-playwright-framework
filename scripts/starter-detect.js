#!/usr/bin/env node
/**
 * certance-starter — repo-state mode detector.
 *
 * Inspects the current working directory (and any source hint passed as an
 * argument) and reports which of the four "how do I start testing this?" modes
 * are viable, plus a recommended route. It is the deterministic half of the
 * dispatcher: the `certance-starter` agent runs this, then combines the signals
 * here with the user's stated intent (the LLM half) to pick a hand-off.
 *
 * Modes
 *   ① existing-features   features/*.feature has scenarios   → playwright-test-generator
 *   ② requirements-md     requirements/*.md present          → requirements-to-bdd
 *   ②ext confluence       --confluence <id|space> given      → source-to-requirements
 *   ④ doc-url             --url <http…> given                → source-to-requirements
 *   ③ explore-app         a reachable app URL                → playwright-test-planner
 *
 * Usage
 *   node scripts/starter-detect.js [--url <http…>] [--confluence <pageId|SPACE>]
 *   (also reads DOC_URL, CONFLUENCE, BASE_URL from the environment)
 *
 * Output: a human summary on stderr-free stdout, then a machine-readable JSON
 * block between BEGIN_JSON / END_JSON markers so the agent can parse it exactly.
 *
 * Dep-free (mirrors scripts/coverage-report.js) so it runs with no npm install.
 */
const fs = require('fs');
const path = require('path');

const FEATURES_DIR = process.env.FEATURES_DIR || 'features';
const REQ_DIR = process.env.REQ_DIR || 'requirements';

// ── source hints (external inputs the user hands us) ─────────────────────────
function argVal(flag) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(flag + '='));
  return eq ? eq.slice(flag.length + 1) : '';
}
const docUrl = argVal('--url') || process.env.DOC_URL || '';
const confluence = argVal('--confluence') || process.env.CONFLUENCE || '';
const baseUrl = process.env.BASE_URL || '';

// ── ① existing .feature files with at least one scenario ─────────────────────
function featureSignal() {
  if (!fs.existsSync(FEATURES_DIR)) return { count: 0, files: [] };
  const files = fs.readdirSync(FEATURES_DIR).filter((f) => f.endsWith('.feature'));
  let scenarios = 0;
  const withScenarios = [];
  for (const f of files) {
    const body = fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8');
    const n = (body.match(/^\s*Scenario(\s+Outline)?:/gm) || []).length;
    scenarios += n;
    if (n > 0) withScenarios.push(f);
  }
  return { count: scenarios, files: withScenarios };
}

// ── ② requirement docs (exclude README + _TEMPLATE/_partials) ────────────────
function requirementSignal() {
  if (!fs.existsSync(REQ_DIR)) return { count: 0, files: [] };
  const files = fs
    .readdirSync(REQ_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md');
  return { count: files.length, files };
}

const feat = featureSignal();
const reqs = requirementSignal();

const modes = [
  {
    id: '4-doc-url',
    label: '④ Project docs on the web',
    agent: 'source-to-requirements',
    viable: Boolean(docUrl),
    evidence: docUrl ? `--url ${docUrl}` : 'no --url / DOC_URL given',
  },
  {
    id: '2ext-confluence',
    label: '② Confluence page/space',
    agent: 'source-to-requirements',
    viable: Boolean(confluence),
    evidence: confluence
      ? `--confluence ${confluence} (needs the Atlassian MCP authorized)`
      : 'no --confluence / CONFLUENCE given',
  },
  {
    id: '2-requirements-md',
    label: '② Local requirement specs',
    agent: 'requirements-to-bdd',
    viable: reqs.count > 0,
    evidence: reqs.count > 0 ? `${reqs.count} file(s): ${reqs.files.join(', ')}` : `no specs in ${REQ_DIR}/`,
  },
  {
    id: '1-existing-features',
    label: '① Existing BDD scenarios',
    agent: 'playwright-test-generator',
    viable: feat.count > 0,
    evidence:
      feat.count > 0 ? `${feat.count} scenario(s) in ${feat.files.join(', ')}` : `no scenarios in ${FEATURES_DIR}/`,
  },
  {
    id: '3-explore-app',
    label: '③ Explore a running app',
    agent: 'playwright-test-planner',
    viable: true, // always an option; needs a reachable app URL at run time
    evidence: baseUrl ? `BASE_URL=${baseUrl}` : 'fallback — supply the app URL to explore',
  },
];

// ── recommendation: explicit external source wins, then specs, then features,
//    then explore. Flag ambiguity when >1 non-fallback mode is viable. ────────
const PRECEDENCE = ['4-doc-url', '2ext-confluence', '2-requirements-md', '1-existing-features', '3-explore-app'];
const viableOrdered = PRECEDENCE.map((id) => modes.find((m) => m.id === id)).filter((m) => m.viable);
const recommended = viableOrdered[0];
const nonFallbackViable = viableOrdered.filter((m) => m.id !== '3-explore-app');
const ambiguous = nonFallbackViable.length > 1 && !docUrl && !confluence;

// ── human summary ────────────────────────────────────────────────────────────
console.log('certance-starter — how should we start?\n');
for (const m of modes) {
  console.log(`  ${m.viable ? '✅' : '  '} ${m.label.padEnd(30)} → ${m.agent}`);
  console.log(`     ${m.evidence}`);
}
console.log(`\n  Recommended: ${recommended.label}  →  ${recommended.agent}`);
if (ambiguous) {
  console.log(
    `  ⚠️  More than one starting point is viable (${nonFallbackViable.map((m) => m.id).join(', ')}).\n` +
      `      Confirm intent with the user before routing.`,
  );
}

// ── machine-readable block for the agent ─────────────────────────────────────
console.log('\nBEGIN_JSON');
console.log(
  JSON.stringify(
    {
      modes: modes.map(({ id, agent, viable, evidence }) => ({ id, agent, viable, evidence })),
      recommended: { mode: recommended.id, agent: recommended.agent },
      ambiguous,
      hints: { docUrl: docUrl || null, confluence: confluence || null, baseUrl: baseUrl || null },
    },
    null,
    2,
  ),
);
console.log('END_JSON');
