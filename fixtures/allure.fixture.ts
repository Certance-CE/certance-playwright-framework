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
// One entry per feature-area tag your .feature files carry. A tag with no entry
// here produces a scenario with NO epic/feature label, which silently drops it
// out of Allure's Behaviors tree — so extend this map whenever you add an area.
const EPIC_BY_TAG: Record<string, string> = {
  authentication: 'Authentication',
  todos: 'Todo list',
  'task-management': 'Task management',
};

const SEVERITY_BY_TAG: Record<string, string> = {
  smoke: 'critical',
  regression: 'normal',
  wip: 'trivial',
};

export const test = pageTest.extend<{ _allureCoverage: void }>({
  _allureCoverage: [
    async ({}, use) => {
      const info = test.info();
      const tags = info.tags.map((t) => t.replace(/^@/, ''));
      // The level below the epic is the Gherkin `Feature:` (or the spec's outer describe),
      // so a reader drills from business area to feature to scenario, not epic to epic.
      const [, outer] = info.titlePath;
      const featureName = info.titlePath.length > 2 && outer ? outer : undefined;

      // What is not about the application under test gets a heading of its own, so a
      // customer reading about their app does not wade through the framework's internals.
      const own = /(^|\/)framework-tests\//.test(info.file.replace(/\\/g, '/'));
      if (own || info.project.name === 'setup') {
        await epic(own ? 'Framework self-checks' : 'Session setup');
        if (featureName) await feature(featureName);
      }

      for (const t of tags) {
        if (EPIC_BY_TAG[t]) {
          await epic(EPIC_BY_TAG[t]);
          await feature(featureName ?? EPIC_BY_TAG[t]);
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
      // A test with no area tag still belongs somewhere: under its own feature, rather than
      // loose at the bottom of the report where nobody reads it.
      if (!own && info.project.name !== 'setup' && !tags.some((t) => EPIC_BY_TAG[t]) && featureName) {
        await epic(featureName);
        await feature(featureName);
      }
      const sev = tags.map((t) => SEVERITY_BY_TAG[t]).find(Boolean);
      if (sev) await severity(sev);
      await use();
    },
    { auto: true },
  ],
});
