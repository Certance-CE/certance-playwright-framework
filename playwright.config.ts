import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { config } from 'dotenv';
import { target } from './app.config';

config();

// BDD project: Gherkin .feature files -> generated specs in .features-gen/
const bddOutputDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['features/step-definitions/**/*.ts', 'fixtures/index.ts'],
  disableWarnings: { importTestFrom: true },
});

// Sharding uses the `blob` reporter (set PW_BLOB=1 per shard) so shard outputs can
// be recombined with `npx playwright merge-reports`. Scale out horizontally with CI
// shards; raise PW_WORKERS per shard as the app under test allows.
const reportFormat: 'html' | 'blob' = process.env.PW_BLOB ? 'blob' : 'html';

// The application under test — its URL, how it starts, and the lanes that run against it —
// lives in app.config.ts. This file is the core and does not change when you retarget.
const app = target({ bddDir: bddOutputDir });

export default defineConfig({
  testDir: './tests',
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // A test that fails and then passes on retry is reported as flaky, and by default
  // the run is still GREEN. That is how this repo shipped a flaky sign-in scenario
  // without noticing: `1 flaky` in the log, a tick on the pull request. Retries stay
  // — a genuinely transient network fault should not fail a build — but a flake is
  // now a failure you have to look at rather than a line you scroll past.
  failOnFlakyTests: !!process.env.CI,
  workers: process.env.CI ? Number(process.env.PW_WORKERS) || 1 : undefined,
  timeout: 90_000,
  // Visual-regression defaults (see utils/visual.ts + skills/core/visual.md).
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      scale: 'css',
      maxDiffPixelRatio: 0.01,
    },
  },
  reporter: [
    ['list'],
    [reportFormat],
    ['json', { outputFile: 'test-results/results.json' }],
    [
      'allure-playwright',
      {
        outputFolder: 'allure-results',
        suiteTitle: false,
        environmentInfo: {
          framework: 'Certance Lens',
          node_version: process.version,
          base_url: app.baseURL,
        },
      },
    ],
    // CTRF JSON — feeds the GitHub Actions run summary (github-actions-ctrf).
    ['playwright-ctrf-json-reporter', { outputFile: 'ctrf-report.json', outputDir: 'ctrf' }],
  ],
  use: {
    baseURL: app.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  ...(app.webServer ? { webServer: app.webServer } : {}),

  projects: [
    ...app.projects,
    // Framework self-tests: hermetic, no application involved. They live in
    // framework-tests/ rather than tests/ so the split is visible in the file tree:
    // tests/ holds tests OF THE APPLICATION, framework-tests/ holds tests of this
    // framework's own helpers. No testIgnore needed — the directory says it.
    {
      name: 'chromium',
      testDir: './framework-tests',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
