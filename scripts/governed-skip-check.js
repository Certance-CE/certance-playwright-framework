#!/usr/bin/env node
/**
 * Governed integrity gate — the Governed Loop's GATE 2 (ADR-009).
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
 * The same diff is checked for the two quieter ways to weaken a test, across the test lanes
 * and `pages/` (where Page Object assertions live):
 *
 *   - an ASSERTION REMOVED — more `expect(` lines deleted than added across the diff. Counted
 *     diff-wide, so moving an assertion from a step into a Page Object nets to zero. Commenting
 *     one out counts as removing it. The removed line cannot carry a note, so the reason is a
 *     `governed-change:` note added anywhere in the diff.
 *   - an ASSERTED VALUE CHANGED — an `expect(x)` line replaced by one on the same subject that
 *     says something different (`toHaveCount(2)` → `toHaveCount(3)`). The reason goes inline on
 *     the new line: `// governed-change: REQ-123 now allows three`.
 *
 * Textual, single-line, and deliberately a floor: a matcher split across lines is counted by
 * its `expect(` line only.
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
// The recorded, human-authored reason that lets a genuine skip or assertion change through.
const WAIVER = /governed-(?:skip|change):/;
// Files whose assertions guard behaviour: the test lanes plus the Page Objects.
const ASSERT_FILE = new RegExp(`${TEST_FILE.source}|(?:^|/)pages/`);
// An assertion line: expect( / expect.soft( / expect.poll( — not one that is commented out.
const ASSERTION = /\bexpect(?:\.soft|\.poll)?\s*\(/;
const COMMENT = /^\s*(?:\/\/|\/?\*)/;

const isAssertion = (line) => ASSERTION.test(line) && !COMMENT.test(line);
/** What an assertion is about: the expect(...) argument, so a changed claim on it can be paired. */
const subjectOf = (line) => (line.match(/\bexpect(?:\.soft|\.poll)?\s*\((.*?)\)\s*\.(?:not\.)?to/) || [])[1];
const norm = (line) => line.replace(/\s+/g, ' ').trim();

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

/**
 * Scan a unified git diff for weakened assertions; return `{ removed, changed }`.
 * `changed`: a removed assertion paired (by subject) with an added one that differs, unwaived.
 * `removed`: the unpaired removed assertions, when they outnumber the unpaired added ones and
 * the diff records no `governed-change:` reason anywhere.
 */
function scanAssertions(diff) {
  const removed = [];
  const added = [];
  let waived = false;
  let file = null;
  for (const raw of String(diff).split('\n')) {
    // The file a hunk belongs to: the new path, or the old one when the file was deleted.
    const old = raw.match(/^--- a\/(.+)$/);
    if (old) {
      file = old[1];
      continue;
    }
    const neu = raw.match(/^\+\+\+ b\/(.+)$/);
    if (neu) {
      file = neu[1];
      continue;
    }
    if (raw.startsWith('+++') || raw.startsWith('---') || raw.startsWith('diff ')) continue;
    const sign = raw[0];
    if (sign !== '+' && sign !== '-') continue;
    const line = raw.slice(1);
    if (sign === '+' && WAIVER.test(line)) waived = true;
    if (!file || !ASSERT_FILE.test(file) || !isAssertion(line)) continue;
    (sign === '+' ? added : removed).push({ file, line: norm(line), subject: subjectOf(line) });
  }

  // Pair each removed assertion with an added one: identical text is a move, same subject is a change.
  const changed = [];
  const unpairedRemoved = [];
  for (const r of removed) {
    let i = added.findIndex((a) => a.line === r.line);
    if (i === -1 && r.subject !== undefined) i = added.findIndex((a) => a.subject === r.subject);
    if (i === -1) {
      unpairedRemoved.push(r);
      continue;
    }
    const [a] = added.splice(i, 1);
    if (a.line !== r.line && !WAIVER.test(a.line)) changed.push({ file: a.file, from: r.line, to: a.line });
  }
  const net = unpairedRemoved.length > added.length && !waived;
  return { removed: net ? unpairedRemoved : [], changed };
}

module.exports = { scanDiff, scanAssertions, TEST_FILE, ASSERT_FILE, WEAKEN, WAIVER };

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
  const { removed, changed } = scanAssertions(diff);
  if (violations.length) {
    console.error(`\ngoverned-skip gate: ${violations.length} test(s) muted without a recorded reason.`);
    console.error('A skipped, fixme-d or .only-focused test hides a failure. Record why on the line:');
    console.error("  test.fixme('…', async () => { // governed-skip: APP-123 reject flow broken upstream");
    console.error('\nOffending additions:');
    for (const v of violations) console.error(`  ✗ ${v.file}: ${v.line}`);
  }
  if (changed.length) {
    console.error(`\ngoverned-skip gate: ${changed.length} asserted value(s) changed without a recorded reason.`);
    console.error('Changing what a test expects can make a broken behaviour pass. Record why on the new line:');
    console.error('  await expect(items).toHaveCount(3); // governed-change: REQ-123 now allows three');
    for (const c of changed) console.error(`  ✗ ${c.file}:\n      was: ${c.from}\n      now: ${c.to}`);
  }
  if (removed.length) {
    console.error(`\ngoverned-skip gate: ${removed.length} assertion(s) removed without a recorded reason.`);
    console.error('A test with fewer assertions catches fewer defects. Add a governed-change: note to the diff');
    console.error('saying why, e.g. in the commit to the spec:  // governed-change: REQ-123 retired');
    for (const r of removed) console.error(`  ✗ ${r.file}: ${r.line}`);
  }
  if (violations.length || changed.length || removed.length) process.exit(1);
  console.log('governed-skip gate: no test muted, no assertion removed or changed without a recorded reason ✓');
}
