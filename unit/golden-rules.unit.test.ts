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

  it('reports every violation as an error, never a warning', async () => {
    // The lint script runs with --max-warnings=0, but a rule set to "warn" would
    // still pass a bare `eslint .` — so severity is pinned here too.
    const messages = await lint(`test('x', async ({ page }) => { await page.click('#a'); });`, SPEC);
    const golden = messages.filter((m) => /Golden rule/.test(m.message));
    expect(golden.length).toBeGreaterThan(0);
    expect(golden.every((m) => m.severity === 2)).toBe(true);
  });
});
