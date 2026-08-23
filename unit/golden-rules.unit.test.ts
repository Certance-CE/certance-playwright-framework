import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint } from 'eslint';

/**
 * Tests for the lint rules themselves.
 *
 * The framework claims its golden rules are "machine-enforced". That claim is only
 * worth something if the rules actually fire, so each one is exercised here against
 * a code sample that should break it. If someone loosens a rule, or a config refactor
 * silently drops one, these fail.
 *
 * Deliberately asserts on the rule id and the message, not just "some error" — a
 * violation reported by the wrong rule would otherwise pass.
 */
let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint();
});

async function lint(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: false });
  return (result?.messages ?? []).map((m) => ({
    ruleId: m.ruleId,
    message: m.message,
    severity: m.severity,
  }));
}

const SPEC = 'tests/probe.spec.ts';
const PAGE = 'pages/ProbePage.ts';
const UTIL = 'utils/probe.ts';
const FIXTURE = 'fixtures/probe.fixture.ts';
const SETUP = 'tests/probe.setup.ts';
const SELFTEST = 'framework-tests/probe.spec.ts';

describe('golden rules are machine-enforced', () => {
  it('rejects driving the page directly from a spec (rule 2: Page Objects)', async () => {
    const messages = await lint(`test('x', async ({ page }) => { await page.click('#submit'); });`, SPEC);
    expect(messages.some((m) => m.ruleId === 'no-restricted-syntax' && /Golden rule #2/.test(m.message))).toBe(true);
  });

  it('rejects .locator() anywhere it is allowed to appear (rule 1: no CSS/XPath)', async () => {
    for (const filePath of [SPEC, PAGE]) {
      const messages = await lint(`const el = page.locator('.brittle');`, filePath);
      expect(
        messages.some((m) => m.ruleId === 'no-restricted-syntax' && /Golden rule #1/.test(m.message)),
        `expected .locator() to be rejected in ${filePath}`,
      ).toBe(true);
    }
  });

  it('rejects page.$ and page.$$ (rule 1: they take CSS selectors)', async () => {
    for (const code of [`await page.$('.x');`, `await page.$$('.x');`]) {
      const messages = await lint(code, SPEC);
      expect(
        messages.some((m) => /Golden rule #1/.test(m.message)),
        `expected ${code} to be rejected`,
      ).toBe(true);
    }
  });

  it('rejects text-based locators in a spec (rule 1: they belong behind a Page Object)', async () => {
    const messages = await lint(`await expect(page.getByText('Submitted')).toBeVisible();`, SPEC);
    expect(messages.some((m) => /Golden rule #1/.test(m.message))).toBe(true);
  });

  it('rejects arbitrary waits (rule 5: web-first assertions only)', async () => {
    const messages = await lint(`test('x', async ({ page }) => { await page.waitForTimeout(500); });`, SPEC);
    expect(messages.some((m) => m.ruleId === 'playwright/no-wait-for-timeout')).toBe(true);
  });

  it('rejects utils/ importing the application layer (rule 12: app-agnostic core)', async () => {
    const messages = await lint(`import { ProbePage } from '../pages/ProbePage';\nexport const x = ProbePage;`, UTIL);
    expect(messages.some((m) => m.ruleId === 'no-restricted-imports' && /Golden rule #12/.test(m.message))).toBe(true);
  });

  it('accepts a compliant Page Object', async () => {
    const code = [
      `export class ProbePage {`,
      `  constructor(private readonly page: import('@playwright/test').Page) {}`,
      `  async submit() {`,
      `    await this.page.getByRole('button', { name: 'Submit' }).click();`,
      `  }`,
      `}`,
    ].join('\n');
    const messages = await lint(code, PAGE);
    expect(messages.filter((m) => m.severity === 2)).toEqual([]);
  });

  it('rejects beforeEach in test code (rule 3: shared setup lives in fixtures)', async () => {
    const messages = await lint(`test.beforeEach(async ({ page }) => { await page.goto('/'); });`, SPEC);
    expect(messages.some((m) => /Golden rule #3/.test(m.message))).toBe(true);
  });

  it('rejects serial mode and module-scoped mutable state (rule 4: independence)', async () => {
    for (const code of [
      `test.describe.configure({ mode: 'serial' });`,
      `test.describe.serial('group', () => {});`,
      `let sharedId = 0;`,
    ]) {
      const messages = await lint(code, SPEC);
      expect(
        messages.some((m) => /Golden rule #4/.test(m.message)),
        `expected to reject: ${code}`,
      ).toBe(true);
    }
  });

  it('allows a framework self-test to order itself (rule 4 is about tests of an APPLICATION)', async () => {
    // framework-tests/cleanup.spec.ts proves teardown runs after a FAILING test, so
    // it must be ordered. The rule would make that self-test impossible to write.
    const messages = await lint(`test.describe.configure({ mode: 'serial' });\nconst disposed = [];`, SELFTEST);
    expect(messages.filter((m) => /Golden rule #4/.test(m.message))).toEqual([]);
  });

  it('rejects page.route() in test code (rule 6: mock through the network fixture)', async () => {
    const messages = await lint(`await page.route('**/pay', (r) => r.fulfill({ status: 200 }));`, SPEC);
    expect(messages.some((m) => /Golden rule #6/.test(m.message))).toBe(true);
  });

  it('rejects literal email addresses and direct faker use (rule 7: synthetic data only)', async () => {
    const email = await lint(`const user = 'joan.smith@realcompany.com';`, SPEC);
    expect(email.some((m) => /Golden rule #7/.test(m.message))).toBe(true);

    const faker = await lint(`import { faker } from '@faker-js/faker';\nconst n = faker;`, SPEC);
    expect(faker.some((m) => /Golden rule #7/.test(m.message))).toBe(true);
  });

  it('rejects constructing a Page Object by hand (rule 11: inject via fixtures)', async () => {
    const messages = await lint(`const loginPage = new LoginPage(page);`, SPEC);
    expect(messages.some((m) => /Golden rule #11/.test(m.message))).toBe(true);
  });

  it('allows a setup project to construct one (no fixtures exist before setup runs)', async () => {
    const messages = await lint(`const loginPage = new LoginPage(page);`, SETUP);
    expect(messages.filter((m) => /Golden rule #11/.test(m.message))).toEqual([]);
  });

  it('rejects naming the application inside the core (rule 12)', async () => {
    for (const filePath of [UTIL, FIXTURE]) {
      const messages = await lint(`export const binary = './.bin/vikunja';`, filePath);
      expect(
        messages.some((m) => /Golden rule #12/.test(m.message)),
        `expected the application name to be rejected in ${filePath}`,
      ).toBe(true);
    }
  });

  it('rejects force: true (rule 5: never switch off actionability)', async () => {
    // The rule this repo learned the hard way on a screen-reader-only checkbox.
    const messages = await lint(`await page.getByRole('checkbox').check({ force: true });`, SPEC);
    expect(messages.some((m) => m.ruleId === 'playwright/no-force-option')).toBe(true);
  });

  it('rejects element handles, page.$eval and networkidle (rule 5: keep auto-waiting)', async () => {
    const cases = [
      [`const h = await page.$('#a');`, 'playwright/no-element-handle'],
      [`await page.$eval('#a', (e) => e.textContent);`, 'playwright/no-eval'],
      [`await page.waitForLoadState('networkidle');`, 'playwright/no-networkidle'],
    ] as const;
    for (const [code, ruleId] of cases) {
      const messages = await lint(code, SPEC);
      expect(
        messages.some((m) => m.ruleId === ruleId),
        `expected ${ruleId} for: ${code}`,
      ).toBe(true);
    }
  });

  it('keeps every earlier rule alive alongside the new ones', async () => {
    // no-restricted-syntax does not MERGE across config blocks — a later block
    // replaces the list. This is the regression test for someone adding a block and
    // silently switching off rules 1 and 2.
    const messages = await lint(
      `test('x', async ({ page }) => { await page.click('#a'); const el = page.locator('.b'); });`,
      SPEC,
    );
    expect(messages.some((m) => /Golden rule #1/.test(m.message))).toBe(true);
    expect(messages.some((m) => /Golden rule #2/.test(m.message))).toBe(true);
  });

  it('reports every violation as an error, never a warning', async () => {
    // The lint script runs with --max-warnings=0, but a rule set to "warn" would
    // still pass a bare `eslint .` — so severity is pinned here too.
    const messages = await lint(`test('x', async ({ page }) => { await page.click('#a'); });`, SPEC);
    const golden = messages.filter((m) => /Golden rule/.test(m.message));
    expect(golden.length).toBeGreaterThan(0);
    expect(golden.every((m) => m.severity === 2)).toBe(true);
  });
});
