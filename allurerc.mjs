import { readFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';
import { defineConfig } from 'allure';

/**
 * The customer-facing quality report: one standalone HTML file (`allure-report/index.html`)
 * that holds the run's results grouped by business area and feature, every failure with
 * its trace and screenshot, the requirement traceability matrix and the performance budget
 * table (as global attachments), and the trend across previous runs.
 *
 * Built by `npm run report` after the suite, coverage:requirements and perf:summary. It is
 * a download, not a published page, on purpose: it contains screenshots of the application
 * under test, so where it goes is the reader's decision.
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const env = process.env;

// Where this run came from, so a reader can tie the report to the exact build. Only the
// values the CI provides are shown; a local run has none.
const variables = Object.fromEntries(
  Object.entries({
    Commit: env.GITHUB_SHA?.slice(0, 7),
    Branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME,
    'CI run':
      env.GITHUB_RUN_ID && `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
  }).filter(([, value]) => value),
);

export default defineConfig({
  name: env.REPORT_NAME || pkg.certance?.reportName || 'Quality report',
  output: './allure-report',
  // The trend: one line per run, carried between CI runs by the workflow's cache.
  historyPath: './allure-history/history.jsonl',
  historyLimit: 30,
  variables,
  globalAttachments: ['./requirements-coverage.md', './performance-report.md'],
  plugins: {
    awesome: {
      options: {
        singleFile: true,
        reportLanguage: 'en',
        groupBy: ['epic', 'feature', 'story'],
      },
    },
  },
});
