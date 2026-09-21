#!/usr/bin/env node
/**
 * Governed-skip gate — a slice of the Governed Loop's integrity gate (GATE 2).
 *
 * The governing invariant: no automated action may reduce the suite's ability to detect a
 * defect. A muted test — `test.skip`, `test.fixme`, or a `.only` that quietly drops every
 * other test — turns a real failure into a green build, and (ungoverned) nobody signed off
 * because nobody was asked. The healer agents are explicitly allowed to reach for
 * `test.fixme()`; this is what stops that being silent.
 *
 * The gate reads the pull request diff and FAILS when a test file gains a `.skip` / `.fixme`
 * / `.only` that carries no recorded reason. A reason is an inline `governed-skip:` note, so
 * a genuine "this feature is broken upstream" skip is allowed — but only in the open, next to
 * the code, where a human put it and a reviewer can see it:
 *
 *   test.fixme('rejects an invalid card', async () => { // governed-skip: APP-123 broken upstream
 *
 * It reads ADDED lines only, so removing a skip (unmuting) is always fine. BDD scenario muting
 * (`@wip`) is caught elsewhere: the requirement coverage gate grades a never-run scenario
 * `pending`, which is not `covered`.
 *
 * Diff source: GOVERNED_SKIP_DIFF_FILE (a file, used by the unit test) or `git diff` against
 * GOVERNED_SKIP_BASE (default origin/main). Dep-free.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

// A path that holds tests. Muting here hides a real check.
const TEST_FILE = /(?:^|\/)(?:tests|specs|framework-tests)\/|\.spec\.ts$|(?:^|\/)features\/step-definitions\//;
// test.skip( / test.fixme( / test.only( / describe.skip( / it.only( … — the muting forms.
const WEAKEN = /\.(?:skip|fixme|only)\s*\(/;
// The recorded, human-authored reason that lets a genuine skip through.
const WAIVER = /governed-skip:/;

/** Scan a unified git diff; return the added test-weakening lines that carry no waiver. */
function scanDiff(diff) {
  const violations = [];
  let file = null;
  for (const raw of String(diff).split('\n')) {
    const h = raw.match(/^\+\+\+ b\/(.+)$/);
    if (h) {
      file = h[1];
      continue;
    }
    // Skip diff metadata; only `+`-prefixed content lines are additions.
    if (raw.startsWith('+++') || raw.startsWith('---') || raw.startsWith('diff ') || !raw.startsWith('+')) continue;
    const added = raw.slice(1);
    if (!file || !TEST_FILE.test(file)) continue;
    if (WEAKEN.test(added) && !WAIVER.test(added)) violations.push({ file, line: added.trim() });
  }
  return violations;
}

module.exports = { scanDiff, TEST_FILE, WEAKEN, WAIVER };

if (require.main === module) {
  let diff = '';
  const fromFile = process.env.GOVERNED_SKIP_DIFF_FILE;
  if (fromFile) {
    diff = fs.readFileSync(fromFile, 'utf8');
  } else {
    const base = process.env.GOVERNED_SKIP_BASE || 'origin/main';
    for (const range of [`${base}...HEAD`, `${base}..HEAD`, base]) {
      try {
        diff = execFileSync('git', ['diff', range], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        break;
      } catch {
        /* try the next range shape */
      }
    }
  }

  const violations = scanDiff(diff);
  if (violations.length) {
    console.error(`\ngoverned-skip gate: ${violations.length} test(s) muted without a recorded reason.`);
    console.error('A skipped, fixme-d or .only-focused test hides a failure. Record why on the line:');
    console.error("  test.fixme('…', async () => { // governed-skip: APP-123 reject flow broken upstream");
    console.error('\nOffending additions:');
    for (const v of violations) console.error(`  ✗ ${v.file}: ${v.line}`);
    process.exit(1);
  }
  console.log('governed-skip gate: no test muted without a recorded reason ✓');
}
