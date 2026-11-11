#!/usr/bin/env node
/**
 * `npm run provenance`: who wrote each change to what the suite checks (Governed Loop, ADR-015).
 *
 * A commit that changes a GOVERNED path (a test lane, `pages/`, a feature file, a step
 * definition, a requirement) declares who wrote it, in a commit trailer:
 *
 *   Provenance: human
 *   Provenance: agent=playwright-test-healer; input=provenance/heal-….json; tool=@playwright/test@1.65.0
 *
 * An agent's declaration names three things: which agent, what it worked from, and the tool
 * version it ran under. The check, run on every pull request, FAILS when:
 *
 *   unknown     a commit changes a governed path and declares nothing. Unknown provenance is not
 *               assumed human: it fails closed, and the fix is to say who wrote it
 *   incomplete  an agent's declaration lacks its agent, input or tool
 *   heal        a healer's commit does not hold the triage it acted on (`input=` must name a
 *               `provenance/*.json` record in the commit), or the change is outside the healer's
 *               authority against that triage (heal:check, ADR-014)
 *
 * Commits that touch nothing governed (dependencies, docs, config) are not asked. It reports,
 * for the governed commits, the share an agent wrote and the share a person reviewed: a commit
 * is reviewed when it carries a `Reviewed-By:` trailer or the pull request has an approval from
 * someone other than its author (PROVENANCE_APPROVERS, set by CI).
 *
 * `npm run provenance -- record` is the healer's step: it copies the run's triage into
 * `provenance/heal-<time>.json` and prints the trailer to commit it with.
 *
 * Range: PROVENANCE_BASE...HEAD (default origin/main). Writes provenance.md. Dep-free.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { TEST_FILE } = require('./governed-skip-check.js');
const { checkHeal } = require('./heal-check.js');

// What the suite checks: the test lanes, the Page Objects, the specifications, the requirements.
const GOVERNED = new RegExp(`${TEST_FILE.source}|^pages/|^features/|^requirements/(?!README\\.md$)`);
// The records a heal carries: the triage it acted on.
const RECORD = /^provenance\/[^/]+\.json$/;
const HEALER = /healer/;

const isGoverned = (file) => GOVERNED.test(file);

/** The last `Provenance:` trailer of a commit message: { kind: 'human' } | { kind: 'agent', … } | null. */
function parseProvenance(message) {
  const lines = String(message).split('\n');
  let value = null;
  for (const l of lines) {
    const m = l.match(/^Provenance:\s*(.+?)\s*$/i);
    if (m) value = m[1];
  }
  if (value === null) return null;
  if (/^human$/i.test(value)) return { kind: 'human' };
  const fields = {};
  for (const part of value.split(';')) {
    const kv = part.match(/^\s*(agent|input|tool)\s*=\s*(.+?)\s*$/i);
    if (kv) fields[kv[1].toLowerCase()] = kv[2];
  }
  return { kind: 'agent', agent: fields.agent, input: fields.input, tool: fields.tool, raw: value };
}

const reviewedBy = (message) => /^Reviewed-By:\s*\S/im.test(String(message));

/**
 * Assess the commits of a pull request.
 * commit: { sha, subject, message, files: string[], diff: string, records: { [path]: string } }
 * Returns { problems: [{ sha, subject, rule, detail }], rows, summary }.
 */
function assess(commits, { approvers = [] } = {}) {
  const problems = [];
  const rows = [];
  for (const c of commits) {
    const governed = c.files.filter(isGoverned);
    if (!governed.length) continue;
    const p = parseProvenance(c.message);
    const problem = (rule, detail) => problems.push({ sha: c.sha, subject: c.subject, rule, detail });
    if (!p) {
      problem('unknown', `changes ${governed.length} governed file(s) and declares no Provenance: trailer`);
    } else if (p.kind === 'agent') {
      const missing = ['agent', 'input', 'tool'].filter((k) => !p[k]);
      if (missing.length) problem('incomplete', `the agent declaration has no ${missing.join(', ')}`);
      if (p.agent && HEALER.test(p.agent)) {
        const record = p.input && RECORD.test(p.input) ? c.records[p.input] : undefined;
        if (record === undefined) {
          problem('heal', 'a heal must commit the triage it acted on and name it: input=provenance/<file>.json');
        } else {
          let items = null;
          try {
            items = JSON.parse(record);
          } catch {
            /* a record that does not parse authorises nothing */
          }
          const v = checkHeal(items, c.diff);
          for (const r of v.refusals) {
            problem('heal', `${r.rule}: ${r.detail}${r.file ? ` (${r.file})` : ''}`);
          }
        }
      }
    }
    // Unknown counts as agent-written: it is the reading that asks for more scrutiny, not less.
    const byAgent = !p || p.kind === 'agent';
    const reviewed = reviewedBy(c.message) || approvers.length > 0;
    rows.push({
      sha: c.sha,
      subject: c.subject,
      author: p ? (p.kind === 'human' ? 'human' : p.agent || 'agent (unnamed)') : 'unknown',
      byAgent,
      reviewed,
      files: governed.length,
    });
  }
  const pct = (n) => (rows.length ? Math.round((100 * n) / rows.length) : 0);
  const agentRows = rows.filter((r) => r.byAgent);
  const summary = {
    governed: rows.length,
    agentAuthored: pct(agentRows.length),
    reviewed: pct(rows.filter((r) => r.reviewed).length),
    agentReviewed: agentRows.length
      ? Math.round((100 * agentRows.filter((r) => r.reviewed).length) / agentRows.length)
      : 0,
  };
  return { problems, rows, summary };
}

const cell = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');

function render({ problems, rows, summary }) {
  let md = '# Provenance\n\n';
  if (!rows.length) return md + 'No commit in this change touches a test, Page Object, feature or requirement.\n';
  md += `**${summary.governed} commit(s) change what the suite checks.** `;
  md += `Agent-authored: **${summary.agentAuthored}%** (unknown counts as agent). `;
  md += `Reviewed by a person: **${summary.reviewed}%** (of the agent-authored: ${summary.agentReviewed}%).\n\n`;
  md += '| Commit | Written by | Reviewed | Governed files |\n|---|---|---|---|\n';
  for (const r of rows) {
    md += `| \`${r.sha.slice(0, 7)}\` ${cell(r.subject)} | ${cell(r.author)} | ${r.reviewed ? 'yes' : 'no'} | ${r.files} |\n`;
  }
  if (problems.length) {
    md += `\n## ✗ ${problems.length} problem(s)\n\n`;
    for (const p of problems) md += `- \`${p.sha.slice(0, 7)}\` ${cell(p.subject)}: **${p.rule}**, ${p.detail}\n`;
    md += '\nAdd the trailer to the commit message, e.g. `Provenance: human`, or for an agent\n';
    md += '`Provenance: agent=<name>; input=<what it worked from>; tool=<package@version>`.\n';
  }
  return md;
}

module.exports = { parseProvenance, assess, render, isGoverned, GOVERNED, RECORD };

// Stryker disable all: git and file I/O, exercised by the CI step; the decisions above are unit-tested.
const ROOT = path.join(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function commitsInRange(base) {
  const shas = git('rev-list', '--no-merges', '--reverse', `${base}..HEAD`).split('\n').filter(Boolean);
  return shas.map((sha) => {
    const message = git('show', '-s', '--format=%B', sha);
    const files = git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha).split('\n').filter(Boolean);
    const records = {};
    for (const f of files.filter((f) => RECORD.test(f))) {
      try {
        records[f] = git('show', `${sha}:${f}`);
      } catch {
        /* deleted in this commit */
      }
    }
    return { sha, subject: message.split('\n')[0], message, files, diff: git('show', '--format=', sha), records };
  });
}

function record() {
  const triage = path.join(ROOT, 'test-results/triage.json');
  if (!fs.existsSync(triage)) {
    console.error('provenance record: no test-results/triage.json; run the suite and `npm run triage` first.');
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rel = `provenance/heal-${stamp}.json`;
  fs.mkdirSync(path.join(ROOT, 'provenance'), { recursive: true });
  fs.copyFileSync(triage, path.join(ROOT, rel));
  const tool = `@playwright/test@${require('@playwright/test/package.json').version}`;
  console.log(`provenance record: wrote ${rel}. Commit it with the heal, and this trailer:\n`);
  console.log(`Provenance: agent=playwright-test-healer; input=${rel}; tool=${tool}`);
}

function main() {
  if (process.argv[2] === 'record') return record();
  const base = process.env.PROVENANCE_BASE || 'origin/main';
  const approvers = (process.env.PROVENANCE_APPROVERS || '').split(',').filter(Boolean);
  const result = assess(commitsInRange(base), { approvers });
  const md = render(result);
  fs.writeFileSync(path.join(ROOT, 'provenance.md'), md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  (result.problems.length ? console.error : console.log)(md.trimEnd());
  if (result.problems.length) process.exit(1);
}

if (require.main === module) main();
// Stryker restore all
