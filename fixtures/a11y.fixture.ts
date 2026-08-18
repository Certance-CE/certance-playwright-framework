import { test as networkTest } from './network.fixture';
import { expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { epic, label, attachment } from 'allure-js-commons';

/**
 * Accessibility fixture (`@axe-core/playwright`).
 *
 * `checkA11y(opts?)` runs an axe scan on the current page (or a sub-region),
 * attaches the violations to the Playwright report **and** to Allure under an
 * "Accessibility" epic, and — unless `failOn: false` — soft-asserts zero
 * violations so a page can fail on a11y without aborting the rest of the test.
 *
 * See skills/core/accessibility.md for guidance and the WCAG tag reference.
 */

export interface A11yOptions {
  /** WCAG tag set (default 2.0/2.1 A + AA). */
  tags?: string[];
  /** Restrict the scan to a CSS region selector. */
  include?: string;
  /** Exclude a region (e.g. a known third-party widget). */
  exclude?: string;
  /** Soft-fail the test on any violation (default true). */
  failOn?: boolean;
}

export interface A11yResult {
  violations: unknown[];
  passes: number;
}

export const test = networkTest.extend<{
  checkA11y: (opts?: A11yOptions) => Promise<A11yResult>;
}>({
  checkA11y: async ({ page }, use, testInfo) => {
    await use(async (opts: A11yOptions = {}) => {
      let builder = new AxeBuilder({ page }).withTags(opts.tags ?? ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
      if (opts.include) builder = builder.include(opts.include as string);
      if (opts.exclude) builder = builder.exclude(opts.exclude);

      const results = await builder.analyze();
      const count = results.violations.length;

      // Surface in both reports.
      await epic('Accessibility');
      await label('a11y_violations', String(count));
      await testInfo.attach('axe-results.json', {
        body: JSON.stringify({ violations: results.violations, url: page.url() }, null, 2),
        contentType: 'application/json',
      });
      if (count > 0) {
        await attachment('a11y-violations', JSON.stringify(results.violations, null, 2), 'application/json');
      }

      if (opts.failOn !== false) {
        expect
          .soft(
            count,
            `${count} accessibility violation(s): ${results.violations.map((v: { id: string }) => v.id).join(', ')}`,
          )
          .toBe(0);
      }
      return { violations: results.violations, passes: results.passes.length };
    });
  },
});
