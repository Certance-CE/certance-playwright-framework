import { test as pageTest } from './pages.fixture';
import { epic, feature, severity, label } from 'allure-js-commons';

/**
 * Auto-applied Allure coverage labels.
 *
 * Maps the Gherkin tags each scenario already carries onto Allure's
 * epic / feature / severity taxonomy, so the report's **Behaviors** tree and
 * **Graphs** (severity, status, trend) become a live coverage view — with no
 * per-scenario annotation.
 *
 * Extend the maps when you add a feature area, or tag a scenario `@journey:<name>`
 * to group it under a user journey for coverage reporting.
 */
const EPIC_BY_TAG: Record<string, string> = {
  authentication: 'Authentication',
  search: 'Search',
  'task-creation': 'Task Management',
  'task-management': 'Task Management',
  'list-views': 'List Views',
};

const SEVERITY_BY_TAG: Record<string, string> = {
  smoke: 'critical',
  regression: 'normal',
  wip: 'trivial',
};

export const test = pageTest.extend<{ _allureCoverage: void }>({
  _allureCoverage: [
    async ({}, use) => {
      const tags = test.info().tags.map((t) => t.replace(/^@/, ''));
      for (const t of tags) {
        if (EPIC_BY_TAG[t]) {
          await epic(EPIC_BY_TAG[t]);
          await feature(EPIC_BY_TAG[t]);
        }
        if (t.startsWith('journey:')) {
          await label('journey', t.slice('journey:'.length));
        }
        // @req:REQ-AUTH-01 → a `requirement` label, so Allure groups/filters by
        // requirement and requirements-coverage.js can map req → test result.
        if (t.startsWith('req:')) {
          await label('requirement', t.slice('req:'.length));
        }
      }
      const sev = tags.map((t) => SEVERITY_BY_TAG[t]).find(Boolean);
      if (sev) await severity(sev);
      await use();
    },
    { auto: true },
  ],
});
