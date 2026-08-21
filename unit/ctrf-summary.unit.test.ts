import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Regression tests for scripts/ctrf-summary.js.
 *
 * The script renders test names and assertion messages into a Markdown table in
 * the GitHub Actions run summary. Those strings carry whatever the application
 * under test put on screen, so they are untrusted input: a stray pipe ends the
 * cell, and a stray backslash can escape the pipe that was supposed to end it.
 * CodeQL flagged the original escaping as js/incomplete-sanitization.
 *
 * These tests drive the real script rather than an exported helper, so what is
 * pinned is the artefact CI actually runs.
 */

const SCRIPT = path.join(__dirname, '../scripts/ctrf-summary.js');

/** Render a CTRF report containing the given tests, and return the Markdown. */
function render(tests: Record<string, unknown>[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ctrf-'));
  const file = path.join(dir, 'ctrf-report.json');
  const failed = tests.filter((t) => t.status === 'failed').length;
  writeFileSync(
    file,
    JSON.stringify({
      results: {
        summary: { tests: tests.length, passed: 0, failed, skipped: 0, start: 0, stop: 1000 },
        tests,
      },
    }),
  );
  return execFileSync('node', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, CTRF_PATH: file, GITHUB_STEP_SUMMARY: '' },
  });
}

/**
 * Split a Markdown table row the way a renderer does: a backslash escapes the
 * next character, so only an UNESCAPED pipe separates cells. Splitting on `|`
 * naively would hide the very bug these tests exist to catch.
 */
function cells(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '\\' && i + 1 < row.length) {
      cur += row[i + 1];
      i++;
    } else if (row[i] === '|') {
      out.push(cur);
      cur = '';
    } else {
      cur += row[i];
    }
  }
  out.push(cur);
  return out.filter((c) => c.trim());
}

/** The body rows of the failures table. */
function rows(md: string): string[][] {
  return md
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.includes('---') && !l.startsWith('| Test |'))
    .map(cells);
}

const failing = (name: string, message: string, filePath = '/repo/tests/spec.ts') => ({
  name,
  message,
  filePath,
  status: 'failed',
});

describe('ctrf-summary table escaping', () => {
  it('keeps a message containing an escaped pipe inside its cell', () => {
    // The CodeQL case. Escaping `|` without escaping `\` first turns this into
    // `\\|` — an escaped backslash followed by a LIVE pipe — and the row grows
    // a fourth column.
    const [row] = rows(render([failing('t', 'expected a \\| b')]));
    expect(row).toHaveLength(3);
    expect(row[2].trim()).toBe('expected a \\| b');
  });

  it('flattens control characters, not just newlines', () => {
    // A lone carriage return ends the row as effectively as a newline does.
    const [row] = rows(render([failing('t', 'line one\rline two\ttabbed')]));
    expect(row).toHaveLength(3);
    expect(row[2].trim()).toBe('line one line two tabbed');
  });

  it('escapes the test name, not only the message', () => {
    const [row] = rows(render([failing('evil | name | here', 'boom')]));
    expect(row).toHaveLength(3);
    expect(row[0].trim()).toBe('evil | name | here');
  });

  it('never truncates in the middle of an escape sequence', () => {
    // Truncating after escaping can leave a trailing `\`. Today the row template
    // pads each cell with a space, so that backslash escapes the space rather
    // than the closing pipe and the damage is invisible — this test does NOT
    // fail against the old implementation. It pins the invariant so that
    // removing the padding later cannot quietly reintroduce the break.
    const [row] = rows(render([failing('t', 'x'.repeat(139) + '\\tail')]));
    expect(row).toHaveLength(3);
  });

  it('strips backticks from the file cell, which is a code span', () => {
    const [row] = rows(render([failing('t', 'boom', '/repo/tests/we`ird.ts')]));
    expect(row).toHaveLength(3);
    expect(row[1]).toContain('`weird.ts`');
  });

  it('renders a clean report unchanged', () => {
    const md = render([failing('adds a todo', 'expected true, got false')]);
    expect(md).toContain('1 failed');
    expect(rows(md)[0].map((c) => c.trim())).toEqual(['adds a todo', '`spec.ts`', 'expected true, got false']);
  });
});
