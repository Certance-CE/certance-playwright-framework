import os from 'node:os';
import path from 'node:path';
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
// APP is the showcase: a real third-party application with a login and an API, which the
// suite starts itself. Running it locally rather than over the internet is what makes the
// suite deterministic, offline-capable, and immune to a hosted demo deciding that CI looks
// like a bot — which is exactly what happened when this ran against a public site.
//
// TODOMVC is the portability lane: no login, nothing to provision. It proves the framework
// is not welded to one application, and needs no download.
const APP_PORT = Number(process.env.APP_PORT) || 3456;
const APP = process.env.BASE_URL || `http://127.0.0.1:${APP_PORT}`;
const TODOMVC = 'https://demo.playwright.dev';
const AUTH_FILE = 'test-data/.auth/user.json';

// A database path unique to this run, so every run starts from an empty application and
// no state leaks between runs. Determinism is a property we assert, not hope for.
const APP_DB = path.join(os.tmpdir(), `certance-lens-${Date.now()}.db`);
const APP_BIN = process.platform === 'win32' ? '.bin\\vikunja.exe' : './.bin/vikunja';

// The demo app's own API — used to provision an isolated account and seed data. The `api`
// fixture hard-codes nothing; the demo's endpoint is supplied here and stays overridable.
// The API origin, not a path. Playwright joins request paths as URLs, so a leading
// slash replaces any path on the baseURL — `/register` against `…/api/v1` silently
// becomes `/register` on the origin. Callers pass the full path instead.
process.env.APP_API_URL ||= APP;

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
  // Starts the demo application for the run and stops it afterwards. Skipped entirely when
  // BASE_URL points somewhere else, so adopting the framework for your own app costs nothing.
  ...(process.env.BASE_URL
    ? {}
    : {
        webServer: {
          command: APP_BIN,
          url: `${APP}/api/v1/info`, // a real health endpoint: no sleeps, no races
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          stdout: 'ignore' as const,
          env: {
            VIKUNJA_DATABASE_TYPE: 'sqlite',
            VIKUNJA_DATABASE_PATH: APP_DB,
            VIKUNJA_FILES_BASEPATH: path.join(os.tmpdir(), 'certance-lens-files'),
            VIKUNJA_SERVICE_PUBLICURL: `${APP}/`,
            VIKUNJA_SERVICE_ENABLEREGISTRATION: 'true',
            VIKUNJA_SERVICE_SECRET: 'certance-lens-demo-not-a-secret',
            VIKUNJA_SERVICE_INTERFACE: `:${APP_PORT}`,
          },
        },
      }),

  projects: [
    // Provisions an isolated account and saves the signed-in state.
    {
      name: 'setup',
      testDir: './tests',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: APP },
    },
    // The showcase: a real application the suite starts itself, signed in.
    {
      name: 'bdd:app',
      testDir: bddOutputDir,
      grep: /@app/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], baseURL: APP, storageState: AUTH_FILE },
    },
    // The portability lane: a different application, no auth, no download.
    {
      name: 'bdd:chromium',
      testDir: bddOutputDir,
      grepInvert: /@app/,
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
