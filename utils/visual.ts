import type { Page } from '@playwright/test';

/**
 * Visual-regression helpers (see skills/core/visual.md).
 *
 * `stabilize(page)` removes the usual sources of screenshot flake — animations,
 * transitions, and the blinking text caret — before a `toHaveScreenshot`
 * assertion. Global defaults (animations disabled, small diff tolerance) live in
 * `playwright.config.ts` under `expect.toHaveScreenshot`; this covers the CSS the
 * config option can't.
 *
 * For genuinely dynamic content (dates, avatars, live counts) pass `mask` to
 * `toHaveScreenshot`, e.g. `toHaveScreenshot({ mask: [page.getByRole('time')] })`.
 */
export async function stabilize(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
      scroll-behavior: auto !important;
    }`,
  });
}
