import { createBdd, type DataTable } from 'playwright-bdd';
import { test } from '../../fixtures';
import { parseBudget } from '../../utils/performance';

const { Then } = createBdd(test);

/**
 * Performance steps — application-agnostic, so they are part of the framework core and
 * survive `npm run init`. Any scenario that has just opened a page can end with one:
 *
 *   Then the page meets its performance budget            # Core Web Vitals "good"
 *   Then the page meets this performance budget:
 *     | lcp | 1500 |
 *     | cls | 0.05 |
 *
 * Measured in the browser (web-vitals) and the engine (CDP), so Chromium only. Each
 * measurement is attached to the Allure result and written to perf-results/, which
 * `npm run perf:summary` turns into the budget table in the CI run summary. A breach
 * fails the scenario: a budget nobody enforces is a wish.
 */
Then('the page meets its performance budget', async ({ perf }) => {
  await perf.assertBudget();
});

Then('the page meets this performance budget:', async ({ perf }, table: DataTable) => {
  await perf.assertBudget(parseBudget(table.raw()));
});
