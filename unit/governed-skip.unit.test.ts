import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The governed-skip gate (scripts/governed-skip-check.js) is a slice of the Governed Loop's
 * integrity gate: a test muted without a recorded reason must fail CI. These tests drive the
 * real script over synthetic diffs, so what is pinned is the artefact CI runs.
 */
const SCRIPT = path.join(__dirname, '../scripts/governed-skip-check.js');

/** Run the real gate over a unified diff; return its exit status and stderr. */
function run(diff: string): { status: number; stderr: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'skipgate-'));
  const file = path.join(dir, 'diff.patch');
  writeFileSync(file, diff);
  try {
    execFileSync('node', [SCRIPT], {
      env: { ...process.env, GOVERNED_SKIP_DIFF_FILE: file },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { status: 0, stderr: '' };
  } catch (e) {
    const err = e as { status?: number; stderr?: string };
    return { status: err.status ?? 1, stderr: String(err.stderr ?? '') };
  }
}

/** A minimal unified diff that ADDS the given lines to one file. */
function added(file: string, lines: string[]): string {
  return (
    `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` +
    lines.map((l) => `+${l}`).join('\n') +
    '\n'
  );
}

describe('governed-skip gate', () => {
  it('fails on a newly added test.fixme with no recorded reason', () => {
    const r = run(added('tests/checkout.spec.ts', ["test.fixme('rejects an invalid card', async () => {"]));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('tests/checkout.spec.ts');
  });

  it('passes when the skip carries a governed-skip: reason', () => {
    const r = run(
      added('tests/checkout.spec.ts', [
        "test.fixme('rejects an invalid card', async () => {  // governed-skip: APP-123 reject flow broken upstream",
      ]),
    );
    expect(r.status).toBe(0);
  });

  it('fails on a newly added .only that would drop every other test', () => {
    const r = run(added('features/step-definitions/todos.steps.ts', ["test.only('just this one', async () => {"]));
    expect(r.status).toBe(1);
  });

  it('ignores a skip added outside a test file', () => {
    const r = run(added('docs/notes.md', ['Sometimes you write test.skip(x) in prose.']));
    expect(r.status).toBe(0);
  });

  it('ignores a REMOVED skip — unmuting a test is always allowed', () => {
    const diff =
      'diff --git a/tests/a.spec.ts b/tests/a.spec.ts\n' +
      '--- a/tests/a.spec.ts\n+++ b/tests/a.spec.ts\n@@ -1 +0,0 @@\n' +
      "-test.skip('old', async () => {});\n";
    expect(run(diff).status).toBe(0);
  });

  it('passes a clean diff that mutes nothing', () => {
    const r = run(
      added('tests/a.spec.ts', [
        "test('adds a todo', async () => {",
        '  await expect(list).toHaveText("milk");',
        '});',
      ]),
    );
    expect(r.status).toBe(0);
  });
});
