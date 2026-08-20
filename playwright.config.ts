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

// Two reference applications, deliberately.
//
// APP is the showcase: a real application with a login, an API and a DOM nobody wrote
// for testing. It is what moves capabilities from "proven against a stub" to "proven
// against a running app". Point BASE_URL at your own application to adopt the framework.
//
// TODOMVC is the portability lane: no login, no API, nothing to provision. It proves the
// framework is not welded to one application, and it keeps a fast signal available when
// the showcase app is unreachable.
const APP = process.env.BASE_URL || 'https://practicesoftwaretesting.com';
const TODOMVC = 'https://demo.playwright.dev';
const AUTH_FILE = 'test-data/.auth/toolshop.json';

// The reference app's API. The `api` fixture deliberately hard-codes nothing, so the
// demo's endpoint is supplied here and stays overridable for your own application.
process.env.APP_API_URL ||= process.env.BASE_URL ? undefined! : 'https://api.practicesoftwaretesting.com';

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
          base_url: APP,
        },
      },
    ],
    // CTRF JSON — feeds the GitHub Actions run summary (github-actions-ctrf).
    ['playwright-ctrf-json-reporter', { outputFile: 'ctrf-report.json', outputDir: 'ctrf' }],
  ],
  use: {
    baseURL: APP,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  projects: [
    // Provisions an isolated account and saves the signed-in state. Everything that
    // needs a session depends on this, so no scenario ever signs in through the UI.
    {
      name: 'setup',
      testDir: './tests',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: APP, testIdAttribute: 'data-test' },
    },
    // The showcase suite — signed in, against the real application.
    {
      name: 'bdd:toolshop',
      testDir: bddOutputDir,
      grep: /@toolshop/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: APP,
        storageState: AUTH_FILE,
        // The showcase app ships `data-test`; TodoMVC ships Playwright's default
        // `data-testid`. The attribute is a property of the application under test,
        // which is why it is set per project and not globally.
        testIdAttribute: 'data-test',
      },
    },
    // The portability lane — no auth, no provisioning, different application.
    {
      name: 'bdd:chromium',
      testDir: bddOutputDir,
      grepInvert: /@toolshop/,
      use: { ...devices['Desktop Chrome'], baseURL: TODOMVC },
    },
    // Framework self-tests: hermetic, no application involved.
    {
      name: 'chromium',
      testDir: './tests',
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: TODOMVC },
    },
  ],
});
