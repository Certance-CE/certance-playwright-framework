import { describe, it, expect } from 'vitest';
import planted from './fixtures/triage/planted-results.json';
// @ts-expect-error: a CommonJS script, imported (not required) so Stryker can instrument it.
import provenanceScript from '../scripts/provenance.js';
// @ts-expect-error: as above.
import triageScript from '../scripts/triage.js';

/**
 * Provenance (Governed Loop, ADR-015): a commit that changes what the suite checks says who wrote
 * it, and unknown provenance fails closed. A heal carries the triage it acted on, so CI can hold
 * it to the healer's authority (ADR-014) without the run that produced it.
 */
const { parseProvenance, assess, render, isGoverned } = provenanceScript;
const { triage } = triageScript;

type Item = { class: string };
const items: Item[] = triage(planted);
const testOnly = JSON.stringify(items.filter((i) => i.class === 'test'));
const productOnly = JSON.stringify(items.filter((i) => i.class === 'product'));

const RENAME = [
  'diff --git a/pages/TodoPage.ts b/pages/TodoPage.ts',
  '--- a/pages/TodoPage.ts',
  '+++ b/pages/TodoPage.ts',
  '@@ -1 +1 @@',
  "-    this.add = page.getByRole('button', { name: 'Add' });",
  "+    this.add = page.getByRole('button', { name: 'Create' });",
].join('\n');

const HEALER = 'Provenance: agent=playwright-test-healer; input=provenance/heal-1.json; tool=@playwright/test@1.65.0';

let n = 0;
/** A commit as the CI step reads it. */
const commit = (over: Partial<Record<string, unknown>> = {}) => ({
  sha: `${String(++n).padStart(7, '0')}abcdef`,
  subject: 'fix: something',
  message: 'fix: something\n',
  files: ['pages/TodoPage.ts'],
  diff: RENAME,
  records: {},
  ...over,
});
const rules = (r: { problems: { rule: string }[] }) => r.problems.map((p) => p.rule);

describe('provenance — reading the trailer', () => {
  it('reads human, a full agent declaration, and nothing', () => {
    expect(parseProvenance('feat: x\n\nProvenance: human\n')).toEqual({ kind: 'human' });
    expect(parseProvenance('x\n\nprovenance:   HUMAN  ')).toEqual({ kind: 'human' });
    expect(parseProvenance(`x\n\n${HEALER}`)).toEqual({
      kind: 'agent',
      agent: 'playwright-test-healer',
      input: 'provenance/heal-1.json',
      tool: '@playwright/test@1.65.0',
      raw: HEALER.slice('Provenance: '.length),
    });
    expect(parseProvenance('feat: x\n\nCo-Authored-By: Someone')).toBeNull();
  });

  it('the last trailer wins, and only a line that starts with it counts', () => {
    expect(parseProvenance('x\n\nProvenance: agent=a; input=i; tool=t\nProvenance: human')).toEqual({ kind: 'human' });
    expect(parseProvenance('x\n\nsee Provenance: human in the docs')).toBeNull();
  });

  it('an agent declaration keeps only the fields it names, case-insensitively', () => {
    expect(parseProvenance('Provenance: AGENT = gen ; Tool=pw@1 ; colour=red')).toMatchObject({
      kind: 'agent',
      agent: 'gen',
      input: undefined,
      tool: 'pw@1',
    });
    expect(parseProvenance('Provenance: someone')).toMatchObject({ kind: 'agent', agent: undefined });
  });
});

describe('provenance — what is governed', () => {
  it('the test lanes, Page Objects, features, steps and requirements', () => {
    for (const f of [
      'tests/a.spec.ts',
      'framework-tests/b.ts',
      'specs/c.md',
      'x/d.spec.ts',
      'pages/TodoPage.ts',
      'features/todos.feature',
      'features/step-definitions/todo.steps.ts',
      'requirements/TODO.md',
    ]) {
      expect(isGoverned(f)).toBe(true);
    }
  });

  it('not dependencies, docs, config, scripts, or the requirements README', () => {
    for (const f of [
      'package.json',
      'package-lock.json',
      'README.md',
      'docs/x.md',
      'playwright.config.ts',
      'scripts/triage.js',
      'requirements/README.md',
      'src/pages/x.ts',
      'unit/x.unit.test.ts',
    ]) {
      expect(isGoverned(f)).toBe(false);
    }
  });
});

describe('provenance — fail closed', () => {
  it('a governed change with no declaration fails, and counts as agent-written', () => {
    const r = assess([commit()]);
    expect(r.problems).toEqual([
      {
        sha: r.rows[0].sha,
        subject: 'fix: something',
        rule: 'unknown',
        detail: 'changes 1 governed file(s) and declares no Provenance: trailer',
      },
    ]);
    expect(r.rows[0]).toMatchObject({ author: 'unknown', byAgent: true, reviewed: false, files: 1 });
    expect(r.summary).toEqual({ governed: 1, agentAuthored: 100, reviewed: 0, agentReviewed: 0 });
  });

  it('a commit that touches nothing governed is not asked', () => {
    const r = assess([commit({ files: ['package.json', 'docs/x.md'] })]);
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([]);
    expect(r.summary).toEqual({ governed: 0, agentAuthored: 0, reviewed: 0, agentReviewed: 0 });
  });

  it('a person declaring human passes, and is not agent-authored', () => {
    const r = assess([commit({ message: 'x\n\nProvenance: human', files: ['features/a.feature', 'README.md'] })]);
    expect(r.problems).toEqual([]);
    expect(r.rows[0]).toMatchObject({ author: 'human', byAgent: false, files: 1 });
  });

  it("an agent's declaration must name its agent, input and tool", () => {
    const r = assess([commit({ message: 'x\n\nProvenance: agent=playwright-test-generator' })]);
    expect(r.problems.map((p: { detail: string }) => p.detail)).toEqual(['the agent declaration has no input, tool']);
    const none = assess([commit({ message: 'x\n\nProvenance: someone' })]);
    expect(none.problems[0].detail).toBe('the agent declaration has no agent, input, tool');
    expect(none.rows[0].author).toBe('agent (unnamed)');
    const full = assess([
      commit({ message: 'x\n\nProvenance: agent=gen; input=plans/a.md; tool=pw@1', files: ['tests/a.spec.ts'] }),
    ]);
    expect(full.problems).toEqual([]);
    expect(full.rows[0]).toMatchObject({ author: 'gen', byAgent: true });
  });
});

describe('provenance — a heal carries the triage it acted on', () => {
  it('a renamed control healed against a test-defect triage passes', () => {
    const r = assess([commit({ message: `x\n\n${HEALER}`, records: { 'provenance/heal-1.json': testOnly } })]);
    expect(r.problems).toEqual([]);
    expect(r.rows[0]).toMatchObject({ author: 'playwright-test-healer', byAgent: true });
  });

  it('the same change against a product-only triage is refused in CI: the regression is a finding', () => {
    const r = assess([commit({ message: `x\n\n${HEALER}`, records: { 'provenance/heal-1.json': productOnly } })]);
    expect(r.problems.map((p: { detail: string }) => p.detail)).toEqual([
      'nothing healable: 3 product defect(s) are findings: report them, do not heal them',
    ]);
  });

  it('a heal that also edits a feature file is refused, naming the file', () => {
    const feature = [
      '--- a/features/todos.feature',
      '+++ b/features/todos.feature',
      '@@ -1 +1 @@',
      '-    Then I see "3" tasks',
      '+    Then I see "2" tasks',
    ].join('\n');
    const r = assess([
      commit({
        message: `x\n\n${HEALER}`,
        files: ['pages/TodoPage.ts', 'features/todos.feature'],
        diff: `${RENAME}\n${feature}`,
        records: { 'provenance/heal-1.json': testOnly },
      }),
    ]);
    expect(r.problems.map((p: { detail: string }) => p.detail)).toEqual([
      'out of scope: outside the locator layer (features/todos.feature)',
    ]);
  });

  it('a heal with no record, a record outside provenance/, or a record that does not parse, is refused', () => {
    const noRecord = assess([commit({ message: `x\n\n${HEALER}` })]);
    expect(noRecord.problems.map((p: { detail: string }) => p.detail)).toEqual([
      'a heal must commit the triage it acted on and name it: input=provenance/<file>.json',
    ]);
    const elsewhere = assess([
      commit({
        message: 'x\n\nProvenance: agent=playwright-test-healer; input=test-results/triage.json; tool=pw@1',
        records: { 'test-results/triage.json': testOnly },
      }),
    ]);
    expect(rules(elsewhere)).toEqual(['heal']);
    const garbled = assess([commit({ message: `x\n\n${HEALER}`, records: { 'provenance/heal-1.json': '{not json' } })]);
    expect(garbled.problems.map((p: { detail: string }) => p.detail)).toEqual([
      'no triage: no triage of this run, so no failure is authorised for healing',
    ]);
  });

  it('only a healer is held to a triage; other agents are not', () => {
    const gen = assess([
      commit({ message: 'x\n\nProvenance: agent=playwright-test-generator; input=plans/a.md; tool=pw@1' }),
    ]);
    expect(gen.problems).toEqual([]);
    const remote = assess([
      commit({ message: 'x\n\nProvenance: agent=playwright-remote-healer; input=plans/a.md; tool=pw@1' }),
    ]);
    expect(rules(remote)).toEqual(['heal']);
  });
});

describe('provenance — review', () => {
  it('a Reviewed-By trailer, or an approval on the pull request, marks a commit reviewed', () => {
    const own = assess([commit({ message: 'x\n\nProvenance: human\nReviewed-By: A Person' })]);
    expect(own.rows[0].reviewed).toBe(true);
    const approved = assess([commit({ message: 'x\n\nProvenance: human' })], { approvers: ['a-reviewer'] });
    expect(approved.rows[0].reviewed).toBe(true);
    const blank = assess([commit({ message: 'x\n\nProvenance: human\nReviewed-By:   ' })]);
    expect(blank.rows[0].reviewed).toBe(false);
  });

  it('reports the agent-authored share, the reviewed share, and the reviewed share of agent work', () => {
    const r = assess([
      commit({ message: 'x\n\nProvenance: human\nReviewed-By: P' }),
      commit({ message: 'x\n\nProvenance: agent=gen; input=i; tool=t\nReviewed-By: P' }),
      commit({ message: 'x\n\nProvenance: agent=gen; input=i; tool=t' }),
      commit({ files: ['docs/a.md'] }),
    ]);
    expect(r.summary).toEqual({ governed: 3, agentAuthored: 67, reviewed: 67, agentReviewed: 50 });
  });
});

describe('provenance — the report', () => {
  it('says so when nothing governed changed', () => {
    expect(render(assess([]))).toBe(
      '# Provenance\n\nNo commit in this change touches a test, Page Object, feature or requirement.\n',
    );
  });

  it('a clean change: the shares and a row per commit, no problem section', () => {
    const out = render(assess([commit({ sha: 'abcdef1234', subject: 'a | b', message: 'x\n\nProvenance: human' })]));
    expect(out).toContain(
      '**1 commit(s) change what the suite checks.** Agent-authored: **0%** (unknown counts as agent).',
    );
    expect(out).toContain('Reviewed by a person: **0%** (of the agent-authored: 0%).');
    expect(out).toContain('| `abcdef1` a \\| b | human | no | 1 |\n');
    expect(out).not.toContain('problem');
  });

  it('a failing change names each problem and how to fix it', () => {
    const out = render(assess([commit({ sha: '1234567zz', subject: 's' })]));
    expect(out).toContain('## ✗ 1 problem(s)');
    expect(out).toContain(
      '- `1234567` s: **unknown**, changes 1 governed file(s) and declares no Provenance: trailer\n',
    );
    expect(out).toContain('`Provenance: agent=<name>; input=<what it worked from>; tool=<package@version>`');
  });
});
