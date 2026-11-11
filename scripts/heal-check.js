#!/usr/bin/env node
/**
 * `npm run heal:check`: the healer's authority, checked (Governed Loop stage 08, ADR-014).
 *
 * Triage (stage 07, ADR-013) decides which failures an agent may touch: only those classed
 * `test`, where the test cannot reach the application's control. This script holds a healer's
 * change to that decision. It reads the run's triage (test-results/triage.json) and the change
 * (the working tree against HEAD, or a heal branch against its base) and REFUSES it when:
 *
 *   no triage       there is no record of what failed, so nothing is authorised (fail closed)
 *   nothing healable every failure is a product defect, the environment, a flake or unclassified:
 *                    the product failures are findings, reported, and none of them is healed
 *   out of scope    a file outside the locator layer changed: anything but `pages/` (where the
 *                    Page Objects keep the locators) and the spec file of a healable failure.
 *                    That rules out feature files, step definitions, requirements and config
 *   assertion       an `expect(` line was added, removed, or changed in what it claims (the matcher
 *                    and its expected value). A healed test asserts exactly what it asserted before;
 *                    only how it finds the control may change, inside an `expect(` or outside one
 *   muted           a `.skip(` / `.fixme(` / `.only(` was added
 *   waiver          a `governed-skip:` / `governed-change:` note was added. Those reasons are a
 *                    person's to write; an agent writing its own would be signing its own permit
 *
 * The integrity gate (ADR-009) protects every change. This check is narrower, and stricter, for
 * the one actor allowed to change tests without a person writing the change: the healer.
 *
 * Inputs: TRIAGE_JSON (default test-results/triage.json); HEAL_DIFF_FILE (a diff file, used by
 * the unit test) or HEAL_BASE (diff that ref...HEAD); otherwise `git diff HEAD`. Exit 1 on refusal.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { WEAKEN, WAIVER } = require('./governed-skip-check.js');

// Stryker disable next-line all: where the files live is configuration, exercised by the CLI.
const ROOT = path.join(__dirname, '..');
// Stryker disable next-line all
const TRIAGE = process.env.TRIAGE_JSON || path.join(ROOT, 'test-results/triage.json');

// The locator layer: Page Objects. A healable failure's own spec file is added per run.
const LOCATOR_LAYER = /^pages\//;
const ASSERTION = /\bexpect(?:\.soft|\.poll)?\s*\(/;

/**
 * What an assertion line claims, with its subject (the locator) taken out: the code before
 * `expect(` and the matcher chain after it. `await expect(this.add).toHaveText('Add')` claims
 * `await expect(…).toHaveText('Add')`. Two lines with the same claim assert the same thing about
 * whatever the locator finds; a line whose claim changed asserts something else.
 */
function claimOf(line) {
  const m = String(line).match(
    /^(.*?\bexpect(?:\.soft|\.poll)?\s*\()(.*?)(\)\s*\.(?:not\.)?(?:to|resolves|rejects).*)$/,
  );
  return m ? `${m[1].trim()}…${m[3]}` : undefined;
}

/** A triage path, relative to wherever Playwright's rootDir was, as a repo-relative suffix. */
const specPath = (f) => String(f || '').replace(/^(?:\.\.?\/)+/, '');

/** The changed lines of a unified diff, per file: [{ file, sign, line }]. */
function changes(diff) {
  const out = [];
  let file = null;
  for (const raw of String(diff).split('\n')) {
    const neu = raw.match(/^\+\+\+ (?:b\/(.+)|\/dev\/null)$/);
    const old = raw.match(/^--- (?:a\/(.+)|\/dev\/null)$/);
    if (old) {
      file = old[1] || null;
      continue;
    }
    if (neu) {
      file = neu[1] || file;
      continue;
    }
    const sign = raw[0];
    if (!file || (sign !== '+' && sign !== '-') || raw.startsWith('diff ')) continue;
    out.push({ file, sign, line: raw.slice(1) });
  }
  return out;
}

/**
 * Decide a healer's change. `items` is triage.json (or null when there is none); `diff` the change.
 * Returns { allowed, refusals: [{ rule, file?, line?, detail }], findings, healable }.
 */
function checkHeal(items, diff) {
  const refusals = [];
  if (!Array.isArray(items)) {
    refusals.push({ rule: 'no triage', detail: 'no triage of this run, so no failure is authorised for healing' });
    return { allowed: false, refusals, findings: [], healable: [] };
  }
  const healable = items.filter((i) => i.healable === true && i.class === 'test');
  const findings = items.filter((i) => i.class === 'product');
  if (!healable.length) {
    refusals.push({
      rule: 'nothing healable',
      detail: findings.length
        ? `${findings.length} product defect(s) are findings: report them, do not heal them`
        : 'no failure in this run is a test defect',
    });
  }
  const specs = healable.map((i) => specPath(i.file)).filter(Boolean);
  const inScope = (file) => LOCATOR_LAYER.test(file) || specs.some((s) => file === s || file.endsWith(`/${s}`));

  const lines = changes(diff);
  const outOfScope = new Set();
  const removedAsserts = [];
  const addedAsserts = [];
  for (const c of lines) {
    if (!inScope(c.file)) {
      if (!outOfScope.has(c.file)) {
        outOfScope.add(c.file);
        refusals.push({ rule: 'out of scope', file: c.file, detail: 'outside the locator layer' });
      }
      continue;
    }
    if (c.sign === '+' && WAIVER.test(c.line)) {
      refusals.push({
        rule: 'waiver',
        file: c.file,
        line: c.line.trim(),
        detail: 'a governed note is a person’s to write',
      });
    }
    if (c.sign === '+' && WEAKEN.test(c.line)) {
      refusals.push({ rule: 'muted', file: c.file, line: c.line.trim(), detail: 'a healed test still runs' });
    }
    if (ASSERTION.test(c.line)) {
      (c.sign === '+' ? addedAsserts : removedAsserts).push({ file: c.file, line: c.line.trim() });
    }
  }
  // A line moved unchanged (removed and re-added verbatim in the same file) asserts the same thing,
  // and so does one whose locator was repaired while the claim (the matcher and its value) stayed.
  for (const r of removedAsserts) {
    let i = addedAsserts.findIndex((a) => a.file === r.file && a.line === r.line);
    const was = claimOf(r.line);
    if (i === -1 && was) i = addedAsserts.findIndex((a) => a.file === r.file && claimOf(a.line) === was);
    if (i !== -1) {
      addedAsserts.splice(i, 1);
      continue;
    }
    refusals.push({ rule: 'assertion', file: r.file, line: r.line, detail: 'an assertion was removed or changed' });
  }
  for (const a of addedAsserts) {
    refusals.push({ rule: 'assertion', file: a.file, line: a.line, detail: 'an assertion was added or changed' });
  }
  return { allowed: refusals.length === 0, refusals, findings, healable };
}

/** The verdict as a person reads it. */
function render({ allowed, refusals, findings, healable }, changedFiles) {
  let out = '';
  if (allowed) {
    out += `heal:check: within authority ✓ (${changedFiles} file(s) changed, locators only; `;
    out += `${healable.length} healable failure(s) in this run)\n`;
  } else {
    out += `heal:check: REFUSED: this change is outside the healer's authority (ADR-014).\n`;
    for (const r of refusals) {
      out += `  ✗ ${r.rule}: ${r.detail}${r.file ? ` (${r.file}${r.line ? `: ${r.line}` : ''})` : ''}\n`;
    }
  }
  if (findings.length) {
    out += `\nFindings, reported and not healed (${findings.length}):\n`;
    for (const f of findings) out += `  🔎 ${f.title}: ${f.reason}\n`;
  }
  return out;
}

module.exports = { checkHeal, changes, render, specPath, claimOf };

// Stryker disable all: reading files and git, exercised by the CLI; the decision above is unit-tested.
function readDiff() {
  if (process.env.HEAL_DIFF_FILE) return fs.readFileSync(process.env.HEAL_DIFF_FILE, 'utf8');
  const args = process.env.HEAL_BASE ? ['diff', `${process.env.HEAL_BASE}...HEAD`] : ['diff', 'HEAD'];
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

if (require.main === module) {
  const items = fs.existsSync(TRIAGE) ? JSON.parse(fs.readFileSync(TRIAGE, 'utf8')) : null;
  const diff = readDiff();
  const verdict = checkHeal(items, diff);
  const files = new Set(changes(diff).map((c) => c.file)).size;
  const out = render(verdict, files);
  (verdict.allowed ? console.log : console.error)(out.trimEnd());
  if (!verdict.allowed) process.exit(1);
}
// Stryker restore all
