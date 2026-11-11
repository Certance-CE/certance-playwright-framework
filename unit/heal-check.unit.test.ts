import { describe, it, expect } from 'vitest';
import planted from './fixtures/triage/planted-results.json';
// @ts-expect-error: a CommonJS script, imported (not required) so Stryker can instrument it.
import healScript from '../scripts/heal-check.js';
// @ts-expect-error: as above.
import triageScript from '../scripts/triage.js';

/**
 * The healer's authority (Governed Loop stage 08, ADR-014). Triage decides which failures an
 * agent may touch; heal:check refuses any change outside that decision. The triage used here is
 * the real one: ten failures planted one per class and run through Playwright.
 */
const { checkHeal, changes, render, specPath, claimOf } = healScript;
const { triage } = triageScript;

type Item = { title: string; class: string; healable: boolean; file: string; reason: string };
const all: Item[] = triage(planted);
const only = (cls: string) => all.filter((i) => i.class === cls);
const rules = (v: { refusals: { rule: string }[] }) => v.refusals.map((r) => r.rule);

/** A one-hunk unified diff of `file`: `-` lines then `+` lines. */
const diff = (file: string, minus: string[], plus: string[]) =>
  [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -1,${minus.length} +1,${plus.length} @@`,
    ...minus.map((l) => `-${l}`),
    ...plus.map((l) => `+${l}`),
  ].join('\n');

// A control renamed by the product: the Add button is now labelled Create.
const RENAME = diff(
  'pages/TodoPage.ts',
  ["    this.add = page.getByRole('button', { name: 'Add' });"],
  ["    this.add = page.getByRole('button', { name: 'Create' });"],
);

describe('heal:check — the acceptance criteria', () => {
  it('a planted product regression is refused by the healer and reported as a finding', () => {
    const v = checkHeal(only('product'), RENAME);
    expect(v.allowed).toBe(false);
    expect(rules(v)).toEqual(['nothing healable']);
    expect(v.refusals[0].detail).toBe('3 product defect(s) are findings: report them, do not heal them');
    expect(v.findings.map((f: Item) => f.title)).toEqual(only('product').map((f) => f.title));
    const out = render(v, 1);
    expect(out).toContain("REFUSED: this change is outside the healer's authority (ADR-014)");
    expect(out).toContain('Findings, reported and not healed (3):');
    expect(out).toContain('🔎 ../framework-tests/zz-planted.spec.ts › product: wrong value');
  });

  it('a renamed control is repaired without the assertion changing', () => {
    const v = checkHeal(only('test'), RENAME);
    expect(v.refusals).toEqual([]);
    expect(v.allowed).toBe(true);
    expect(render(v, 1)).toBe(
      'heal:check: within authority ✓ (1 file(s) changed, locators only; 3 healable failure(s) in this run)\n',
    );
  });

  it('the same repair is refused once it also changes what the test expects', () => {
    const v = checkHeal(
      only('test'),
      diff(
        'pages/TodoPage.ts',
        ["    this.add = page.getByRole('button', { name: 'Add' });", '    await expect(this.items).toHaveCount(3);'],
        [
          "    this.add = page.getByRole('button', { name: 'Create' });",
          '    await expect(this.items).toHaveCount(2);',
        ],
      ),
    );
    expect(v.allowed).toBe(false);
    expect(v.refusals).toEqual([
      {
        rule: 'assertion',
        file: 'pages/TodoPage.ts',
        line: 'await expect(this.items).toHaveCount(3);',
        detail: 'an assertion was removed or changed',
      },
      {
        rule: 'assertion',
        file: 'pages/TodoPage.ts',
        line: 'await expect(this.items).toHaveCount(2);',
        detail: 'an assertion was added or changed',
      },
    ]);
  });
});

describe('heal:check — fail closed', () => {
  it('no triage of the run: nothing is authorised', () => {
    const v = checkHeal(null, RENAME);
    expect(v.allowed).toBe(false);
    expect(v.refusals).toEqual([
      { rule: 'no triage', detail: 'no triage of this run, so no failure is authorised for healing' },
    ]);
    expect(checkHeal({ not: 'a list' }, '').allowed).toBe(false);
    expect(checkHeal(null, '')).toMatchObject({ findings: [], healable: [] });
  });

  it('environment, flake and unclassified failures are not healable either', () => {
    for (const cls of ['environment', 'flake']) {
      const v = checkHeal(only(cls), RENAME);
      expect(rules(v)).toEqual(['nothing healable']);
      expect(v.refusals[0].detail).toBe('no failure in this run is a test defect');
    }
    expect(checkHeal([], RENAME).allowed).toBe(false);
  });

  it('an item is healable only when triage said so AND classed it test', () => {
    const forged = only('product').map((i) => ({ ...i, healable: true }));
    expect(rules(checkHeal(forged, RENAME))).toEqual(['nothing healable']);
    const unflagged = only('test').map((i) => ({ ...i, healable: false }));
    expect(rules(checkHeal(unflagged, RENAME))).toEqual(['nothing healable']);
  });

  it('a run with a product finding and a test defect heals the test defect and still reports the finding', () => {
    const v = checkHeal(all, RENAME);
    expect(v.allowed).toBe(true);
    expect(v.findings).toHaveLength(3);
    expect(render(v, 1)).toContain('Findings, reported and not healed (3):');
  });
});

describe('heal:check — scope: the locator layer only', () => {
  it('refuses a feature file, a step definition, a requirement and config, each named once', () => {
    const d = [
      diff('features/todos.feature', ['    Then I see "3" tasks'], ['    Then I see "2" tasks']),
      diff('features/step-definitions/todo.steps.ts', ['  a', '  b'], ['  c', '  d']),
      diff('requirements/TODO.md', ['**Priority:** critical'], ['**Priority:** low']),
      diff('playwright.config.ts', ['  retries: 2,'], ['  retries: 5,']),
    ].join('\n');
    const v = checkHeal(only('test'), d);
    expect(v.refusals).toEqual(
      [
        'features/todos.feature',
        'features/step-definitions/todo.steps.ts',
        'requirements/TODO.md',
        'playwright.config.ts',
      ].map((file) => ({ rule: 'out of scope', file, detail: 'outside the locator layer' })),
    );
  });

  it("allows the healable failure's own spec file, matched by path suffix, and no other spec", () => {
    const own = diff('framework-tests/planted.spec.ts', ["  page.getByText('Old')"], ["  page.getByText('New')"]);
    expect(checkHeal(only('test'), own).allowed).toBe(true);
    const nested = diff('repo/framework-tests/planted.spec.ts', ['  a'], ['  b']);
    expect(checkHeal(only('test'), nested).allowed).toBe(true);
    const other = diff('framework-tests/other.spec.ts', ['  a'], ['  b']);
    expect(rules(checkHeal(only('test'), other))).toEqual(['out of scope']);
    const lookalike = diff('framework-tests/xplanted.spec.ts', ['  a'], ['  b']);
    expect(rules(checkHeal(only('test'), lookalike))).toEqual(['out of scope']);
  });

  it('every healable failure brings its own spec file into scope, not just the first', () => {
    const two = [
      { ...only('test')[0], file: 'tests/a.spec.ts' },
      { ...only('test')[1], file: 'tests/b.spec.ts' },
    ];
    expect(checkHeal(two, diff('tests/b.spec.ts', ['  a'], ['  b'])).allowed).toBe(true);
    expect(checkHeal(two, diff('tests/a.spec.ts', ['  a'], ['  b'])).allowed).toBe(true);
  });

  it('pages/ only at the repo root: a nested pages folder is not the locator layer', () => {
    expect(rules(checkHeal(only('test'), diff('src/pages/x.ts', ['a'], ['b'])))).toEqual(['out of scope']);
  });

  it('a new file is judged by its path, and a deleted one by its old path', () => {
    const created = ['--- /dev/null', '+++ b/features/new.feature', '@@ -0,0 +1 @@', '+Feature: x'].join('\n');
    expect(checkHeal(only('test'), created).refusals[0]).toMatchObject({ file: 'features/new.feature' });
    const deleted = ['--- a/features/old.feature', '+++ /dev/null', '@@ -1 +0,0 @@', '-Feature: x'].join('\n');
    expect(checkHeal(only('test'), deleted).refusals[0]).toMatchObject({ file: 'features/old.feature' });
  });
});

describe('heal:check — inside the locator layer', () => {
  it('refuses a muted test and an agent-written waiver', () => {
    const v = checkHeal(
      only('test'),
      diff(
        'pages/TodoPage.ts',
        [],
        ["  test.fixme('x', async () => {});", '  // governed-change: healer decided the count changed'],
      ),
    );
    expect(v.refusals).toEqual([
      {
        rule: 'muted',
        file: 'pages/TodoPage.ts',
        line: "test.fixme('x', async () => {});",
        detail: 'a healed test still runs',
      },
      {
        rule: 'waiver',
        file: 'pages/TodoPage.ts',
        line: '// governed-change: healer decided the count changed',
        detail: 'a governed note is a person’s to write',
      },
    ]);
  });

  it('a removed skip (unmuting) or a removed waiver is not refused', () => {
    const d = diff('pages/TodoPage.ts', ["  test.skip('x');", '  // governed-skip: APP-1'], []);
    expect(checkHeal(only('test'), d).allowed).toBe(true);
  });

  it('an assertion moved verbatim within a file is the same assertion', () => {
    const line = '    await expect(this.list).toBeVisible();';
    const d = [
      'diff --git a/pages/TodoPage.ts b/pages/TodoPage.ts',
      '--- a/pages/TodoPage.ts',
      '+++ b/pages/TodoPage.ts',
      '@@ -1,3 +1,3 @@',
      `-${line}`,
      '     const x = 1;',
      `+${line}`,
    ].join('\n');
    expect(checkHeal(only('test'), d).allowed).toBe(true);
  });

  it('an assertion moved to another file, a soft or poll assertion, or a new one, is refused', () => {
    const line = '    await expect(this.list).toBeVisible();';
    const moved = [diff('pages/A.ts', [line], []), diff('pages/B.ts', [], [line])].join('\n');
    expect(rules(checkHeal(only('test'), moved))).toEqual(['assertion', 'assertion']);
    for (const added of ['  expect.soft(a).toBe(1);', '  await expect.poll(f).toBe(1);', '  expect (a).ok;']) {
      expect(rules(checkHeal(only('test'), diff('pages/A.ts', [], [added])))).toEqual(['assertion']);
    }
  });

  it('context lines and diff headers are never counted as changes', () => {
    const d = [
      'diff --git a/pages/A.ts b/pages/A.ts',
      'index 1..2 100644',
      '--- a/pages/A.ts',
      '+++ b/pages/A.ts',
      '@@ -1,2 +1,2 @@',
      '   await expect(x).toBe(1);',
      "-  page.getByText('a')",
      "+  page.getByText('b')",
    ].join('\n');
    expect(changes(d)).toEqual([
      { file: 'pages/A.ts', sign: '-', line: "  page.getByText('a')" },
      { file: 'pages/A.ts', sign: '+', line: "  page.getByText('b')" },
    ]);
    expect(changes('')).toEqual([]);
    expect(changes('+orphan line before any header\n-another')).toEqual([]);
  });
});

describe('heal:check — a locator repaired inside an assertion', () => {
  const was = "    await expect(this.page.getByRole('heading', { name: 'Tasks' })).toBeVisible({ timeout: 15_000 });";
  const page = (to: string) => diff('pages/BasePage.ts', [was], [to]);

  it('is allowed when only the locator changed: the claim is the same', () => {
    const healed =
      "    await expect(this.page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 15_000 });";
    expect(checkHeal(only('test'), page(healed)).allowed).toBe(true);
    expect(checkHeal(only('test'), page(healed.replace('getByRole', 'getByTestId'))).allowed).toBe(true);
  });

  it('is refused when the claim changed: matcher, value, negation, or the code around it', () => {
    for (const to of [
      "    await expect(this.page.getByRole('heading', { name: 'Tasks' })).toBeAttached({ timeout: 15_000 });",
      "    await expect(this.page.getByRole('heading', { name: 'Tasks' })).toBeVisible({ timeout: 1 });",
      "    await expect(this.page.getByRole('heading', { name: 'Tasks' })).not.toBeVisible({ timeout: 15_000 });",
      "    void expect(this.page.getByRole('heading', { name: 'Tasks' })).toBeVisible({ timeout: 15_000 });",
      "    await expect.soft(this.page.getByRole('heading', { name: 'Tasks' })).toBeVisible({ timeout: 15_000 });",
    ]) {
      expect(rules(checkHeal(only('test'), page(to)))).toEqual(['assertion', 'assertion']);
    }
  });

  it('pairs within a file only', () => {
    const healed =
      "    await expect(this.page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 15_000 });";
    const across = [diff('pages/A.ts', [was], []), diff('pages/B.ts', [], [healed])].join('\n');
    expect(rules(checkHeal(only('test'), across))).toEqual(['assertion', 'assertion']);
  });

  it('reads the claim of every assertion form, and none of a line that is not one', () => {
    expect(claimOf("  await expect(this.add).toHaveText('Add');")).toBe("await expect(…).toHaveText('Add');");
    expect(claimOf("expect(getByRole('a', { n: 1 })).toBe(x.toString())")).toBe('expect(…).toBe(x.toString())');
    expect(claimOf('expect(a).not.toBe(1)')).toBe('expect(…).not.toBe(1)');
    expect(claimOf('await expect(p).resolves.toBe(1)')).toBe('await expect(…).resolves.toBe(1)');
    expect(claimOf('await expect(p).rejects.toThrow()')).toBe('await expect(…).rejects.toThrow()');
    expect(claimOf('expect.soft(a).toBe(1)')).toBe('expect.soft(…).toBe(1)');
    expect(claimOf('expect.poll(f).toBe(1)')).toBe('expect.poll(…).toBe(1)');
    expect(claimOf('expect (a) .toBe(1)')).toBe('expect (…) .toBe(1)');
    expect(claimOf('expect(a)')).toBeUndefined();
    expect(claimOf('const expected = x;')).toBeUndefined();
  });

  it('a line with no readable claim, moved verbatim, is the same line', () => {
    const d = [diff('pages/A.ts', ['  expect(a)'], []), diff('pages/A.ts', [], ['  expect(a)'])].join('\n');
    expect(checkHeal(only('test'), d).allowed).toBe(true);
  });

  it('a line with no readable claim is still refused when it changes', () => {
    expect(rules(checkHeal(only('test'), diff('pages/A.ts', ['  expect(a)'], ['  expect(b)'])))).toEqual([
      'assertion',
      'assertion',
    ]);
  });
});

describe('heal:check — the report', () => {
  it('names the rule, the file and the line of each refusal', () => {
    const v = checkHeal(only('test'), diff('pages/A.ts', ['  expect(a).toBe(1);'], []));
    expect(render(v, 1)).toContain(
      '  ✗ assertion: an assertion was removed or changed (pages/A.ts: expect(a).toBe(1);)\n',
    );
    const scope = checkHeal(only('test'), diff('features/x.feature', ['a'], ['b']));
    expect(render(scope, 1)).toContain('  ✗ out of scope: outside the locator layer (features/x.feature)\n');
    expect(render(checkHeal(null, ''), 0)).toContain(
      '  ✗ no triage: no triage of this run, so no failure is authorised for healing\n',
    );
  });

  it('no findings, no findings section', () => {
    expect(render(checkHeal(only('test'), RENAME), 1)).not.toContain('Findings');
  });

  it('a triage path from any rootDir is read as a repo-relative suffix', () => {
    expect(specPath('../framework-tests/a.spec.ts')).toBe('framework-tests/a.spec.ts');
    expect(specPath('./../../a.spec.ts')).toBe('a.spec.ts');
    expect(specPath('tests/a.spec.ts')).toBe('tests/a.spec.ts');
    expect(specPath(undefined)).toBe('');
  });
});
