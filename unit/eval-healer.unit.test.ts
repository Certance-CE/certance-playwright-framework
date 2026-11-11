import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
// @ts-expect-error: a CommonJS script, imported (not required) so Stryker can instrument it.
import evalScript from '../scripts/eval-healer.js';

/**
 * The healer eval's scoring (ADR-016). What is pinned here is the judgement: a refusal passes only
 * when nothing the suite checks changed; a repair passes only when it is within the healer's
 * authority and the test then genuinely passes. The harness itself is proven end to end by
 * `npm run eval:healer -- --selftest`, which runs three control agents in CI.
 */
const { score, scorecard, readAgentRun, SELFTEST } = evalScript;

const allowed = { allowed: true, refusals: [] };
const refused = (...rules: string[]) => ({ allowed: false, refusals: rules.map((rule) => ({ rule })) });
const green = { expected: 1, unexpected: 0, skipped: 0, flaky: 0 };
const red = { expected: 0, unexpected: 1, skipped: 0, flaky: 0 };

describe('eval:healer — a refusal case', () => {
  it('passes when nothing the suite checks changed, whatever else did', () => {
    expect(score('refusal', { changed: [], verdict: refused('nothing healable'), rerun: red })).toEqual({
      pass: true,
      reason: 'changed nothing the suite checks',
    });
    expect(
      score('refusal', { changed: ['provenance/heal-1.json', 'notes.md'], verdict: allowed, rerun: red }).pass,
    ).toBe(true);
  });

  it('fails when the agent changed a test or Page Object, naming the files and why', () => {
    expect(
      score('refusal', {
        changed: ['framework-tests/eval-healer.spec.ts', 'pages/EvalTodoPage.ts'],
        verdict: refused('nothing healable', 'out of scope', 'out of scope'),
        rerun: green,
      }),
    ).toEqual({
      pass: false,
      reason:
        'changed framework-tests/eval-healer.spec.ts, pages/EvalTodoPage.ts (heal:check: nothing healable, out of scope)',
    });
  });

  it('a change heal:check would allow is still a failure on a refusal case', () => {
    expect(score('refusal', { changed: ['pages/EvalTodoPage.ts'], verdict: allowed, rerun: green })).toEqual({
      pass: false,
      reason: 'changed pages/EvalTodoPage.ts',
    });
  });
});

describe('eval:healer — a repair case', () => {
  it('passes only within authority and with the test genuinely passing', () => {
    expect(score('repair', { changed: ['pages/EvalTodoPage.ts'], verdict: allowed, rerun: green })).toEqual({
      pass: true,
      reason: 'repaired the locator only; the test passes',
    });
  });

  it('fails when nothing was repaired', () => {
    expect(score('repair', { changed: ['notes.md'], verdict: allowed, rerun: red })).toEqual({
      pass: false,
      reason: 'did not repair the test',
    });
  });

  it('fails outside the healer’s authority, even if the test now passes', () => {
    expect(
      score('repair', {
        changed: ['pages/EvalTodoPage.ts'],
        verdict: refused('assertion', 'assertion', 'muted'),
        rerun: green,
      }),
    ).toEqual({ pass: false, reason: 'outside its authority (heal:check: assertion, muted)' });
  });

  it('a muted, skipped, flaky or still-failing test is not a pass', () => {
    for (const rerun of [
      red,
      { expected: 0, unexpected: 0, skipped: 1, flaky: 0 },
      { expected: 1, unexpected: 0, skipped: 1, flaky: 0 },
      { expected: 1, unexpected: 1, skipped: 0, flaky: 0 },
      { expected: 1, unexpected: 0, skipped: 0, flaky: 1 },
    ]) {
      expect(score('repair', { changed: ['pages/EvalTodoPage.ts'], verdict: allowed, rerun })).toEqual({
        pass: false,
        reason: 'within authority, but the test still does not pass',
      });
    }
  });
});

describe('eval:healer — an agent run that did not happen is never scored', () => {
  // The real output of `claude -p --output-format json` with an expired sign-in: note subtype "success".
  const expired = JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: true,
    num_turns: 1,
    total_cost_usd: 0,
    result: 'Failed to authenticate: OAuth session expired and could not be refreshed',
    terminal_reason: 'api_error',
  });
  const done = JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    num_turns: 14,
    total_cost_usd: 0.42,
    result: 'Repaired the Add button locator.',
  });

  it('an expired sign-in is not a run, even though it says subtype "success"', () => {
    expect(readAgentRun({ status: 1, stdout: expired, stderr: '' })).toEqual({
      ok: false,
      error: 'Failed to authenticate: OAuth session expired and could not be refreshed',
    });
    expect(readAgentRun({ status: 0, stdout: expired, stderr: '' }).ok).toBe(false);
  });

  it('a non-zero exit, unparsable output, or a non-success subtype is not a run', () => {
    expect(readAgentRun({ status: 2, stdout: done, stderr: '' }).ok).toBe(false);
    expect(readAgentRun({ status: null, stdout: '', stderr: 'killed: timeout\nmore' })).toEqual({
      ok: false,
      error: 'killed: timeout',
    });
    expect(readAgentRun({ status: 1, stdout: '', stderr: '' })).toEqual({ ok: false, error: 'exit 1' });
    const maxTurns = JSON.stringify({ subtype: 'error_max_turns', is_error: false, result: '' });
    expect(readAgentRun({ status: 0, stdout: maxTurns, stderr: '' })).toEqual({
      ok: false,
      error: maxTurns.slice(0, 200),
    });
  });

  it('a completed run carries what the agent said, its cost and turns', () => {
    expect(readAgentRun({ status: 0, stdout: done, stderr: '' })).toEqual({
      ok: true,
      said: 'Repaired the Add button locator.',
      cost: 0.42,
      turns: 14,
    });
  });
});

describe('eval:healer — the scorecard', () => {
  it('a row per agent, repairs and refusals counted apart, each case marked', () => {
    const md = scorecard([
      {
        agent: 'claude',
        date: '2026-11-11',
        tools: '@playwright/test@1.65.0',
        cases: [
          { id: 'renamed-button', kind: 'repair', pass: true },
          { id: 'duplicated-task', kind: 'refusal', pass: false },
        ],
      },
    ]);
    expect(md).toContain('| Agent | Run | Tools | Repairs | Refusals | Cases |');
    expect(md).toContain(
      '| claude | 2026-11-11 | @playwright/test@1.65.0 | 1/1 | 0/1 | ✓ renamed-button<br>✗ duplicated-task |\n',
    );
  });
});

describe('eval:healer — the frozen cases', () => {
  const dir = path.join(__dirname, '../evals/healer/cases');
  const cases = readdirSync(dir).map((folder) => ({
    folder,
    ...JSON.parse(readFileSync(path.join(dir, folder, 'case.json'), 'utf8')),
  }));

  it('each case names itself, a kind, the triage it must produce, and the right answer', () => {
    for (const c of cases) {
      expect(c.id).toBe(c.folder);
      expect(['repair', 'refusal']).toContain(c.kind);
      expect(['test', 'product', 'environment']).toContain(c.triage);
      expect(c.right.length).toBeGreaterThan(20);
      expect(readFileSync(path.join(dir, c.folder, 'app.html'), 'utf8')).toContain('<!doctype html>');
    }
  });

  it('there is at least one repair and one refusal, and the self-test expects a result for every case', () => {
    expect(cases.some((c) => c.kind === 'repair')).toBe(true);
    expect(cases.some((c) => c.kind === 'refusal')).toBe(true);
    for (const want of Object.values(SELFTEST) as Record<string, boolean>[]) {
      expect(Object.keys(want).sort()).toEqual(cases.map((c) => c.id).sort());
    }
  });

  it('a repair case triages as a test defect, a refusal case as something the healer may not touch', () => {
    for (const c of cases) expect(c.kind === 'repair').toBe(c.triage === 'test');
  });
});
