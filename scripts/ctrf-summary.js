#!/usr/bin/env node
/**
 * Render the CTRF report (from playwright-ctrf-json-reporter) as a GitHub
 * Actions job summary — a pass/fail/flaky glance right on the run page, no
 * artifact download or GitHub Pages needed. Writes Markdown to
 * $GITHUB_STEP_SUMMARY in CI and to stdout locally.
 *
 * Self-contained (no external action) so it can't rot with the CTRF tooling.
 * Never fails the build.
 */
const fs = require('fs');

const REPORT = process.env.CTRF_PATH || 'ctrf/ctrf-report.json';
const stripAnsi = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '');

/**
 * Render an arbitrary string as one Markdown table cell.
 *
 * Test names and assertion messages carry whatever the application under test
 * put on screen, so they are untrusted. Three rules keep a hostile one inside
 * its cell:
 *
 *  1. Escape the backslash BEFORE the pipe. Escaping only `|` turns an input of
 *     `\|` into `\\|` — an escaped backslash followed by a live pipe, which
 *     breaks out of the cell. This is CodeQL's js/incomplete-sanitization.
 *  2. Truncate BEFORE escaping, so a cut can never land between a backslash and
 *     the character it escapes, leaving a trailing `\` that eats the closing `|`.
 *  3. Flatten every control character, not just `\n`. A lone `\r` ends the row
 *     just as effectively.
 */
const cell = (value, limit = 140) =>
  stripAnsi(value)
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .trim()
    .slice(0, limit)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');

// Inside a code span a backslash escapes nothing, so a backtick cannot be
// escaped out of one — remove it instead.
const codeCell = (value, limit = 140) => cell(value, limit).replace(/`/g, '');

if (!fs.existsSync(REPORT)) {
  console.error(`ctrf-summary: no report at ${REPORT} — skipping`);
  process.exit(0);
}

let results;
try {
  results = JSON.parse(fs.readFileSync(REPORT, 'utf8')).results;
} catch (e) {
  console.error(`ctrf-summary: could not parse ${REPORT}: ${e.message}`);
  process.exit(0);
}

const { summary, tests = [] } = results;
const dur = summary.stop && summary.start ? Math.round((summary.stop - summary.start) / 1000) : 0;
const flaky = tests.filter((t) => t.flaky);

let md = `## 🎭 Playwright test summary\n\n`;
md += `**✅ ${summary.passed} passed · ❌ ${summary.failed} failed · ⏭️ ${summary.skipped} skipped`;
if (flaky.length) md += ` · ⚠️ ${flaky.length} flaky`;
md += ` — ${summary.tests} tests in ${dur}s**\n`;

const failed = tests.filter((t) => t.status === 'failed');
if (failed.length) {
  md += `\n### ❌ Failures\n\n| Test | File | Error |\n|---|---|---|\n`;
  for (const t of failed) {
    const name = cell(t.name);
    const file = codeCell((t.filePath || '').split('/').pop() || '');
    const msg = cell(t.message);
    md += `| ${name || '—'} | \`${file}\` | ${msg || '—'} |\n`;
  }
}

if (flaky.length) {
  md += `\n### ⚠️ Flaky\n\n` + flaky.map((t) => `- ${cell(t.name)}`).join('\n') + '\n';
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}
process.stdout.write(md + '\n');
