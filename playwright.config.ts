import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { config } from 'dotenv';

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

// The reference example runs against the public TodoMVC demo, so `npm test` is green
// on a fresh clone with no credentials. BASE_URL is the app *origin*; Page Objects
// navigate to their own paths (TodoPage → /todomvc/). Point BASE_URL at your own app.
const baseURL = process.env.BASE_URL || 'https://demo.playwright.dev';

export default defineConfig({
  testDir: './tests',
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
          base_url: baseURL,
        },
      },
    ],
    // CTRF JSON — feeds the GitHub Actions run summary (github-actions-ctrf).
    ['playwright-ctrf-json-reporter', { outputFile: 'ctrf-report.json', outputDir: 'ctrf' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  projects: [
    // BDD (Gherkin) project — runs the .feature files via playwright-bdd.
    //
    // For an app that needs a login, capture auth once and add
    // `storageState: 'test-data/.auth/user.json'` here so every scenario starts
    // authenticated (see skills/core/auth.md). The TodoMVC reference example needs
    // no login, so none is wired by default.
    {
      name: 'bdd:chromium',
      testDir: bddOutputDir,
      use: { ...devices['Desktop Chrome'] },
    },
    // Direct spec project — non-BDD spec files under tests/.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
