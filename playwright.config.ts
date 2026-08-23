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

// Every lane that WRITES to the demo application runs one worker at a time.
//
// The app stores its data in SQLite, which serialises writes: concurrent writers get
// HTTP 500 from the very first create. This has now bitten three separate lanes, each
// time on the run where that lane first started writing — so it is named here once
// rather than rediscovered per project.
//
// `workers: 1`, NOT `fullyParallel: false`: the latter only orders tests within a FILE,
// so it appears to work right up until a second spec file is added. Playwright documents
// the per-project worker limit for exactly this — a resource the tests cannot share.
//
// Lanes that touch no application (framework self-tests) and the TodoMVC lane are
// unaffected and stay fully parallel. Point BASE_URL at a server with a real database
// and this is the first thing to raise.
const SERIALISED_WRITES = { workers: 1 } as const;

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
      // Scenarios that exercise signing IN cannot start from a signed-in session.
      grepInvert: /@signed-out/,
      dependencies: ['setup'],
      ...SERIALISED_WRITES,
      use: { ...devices['Desktop Chrome'], baseURL: APP, storageState: AUTH_FILE },
    },
    // The same application with NO session injected.
    //
    // Sign-in scenarios used to run in `bdd:app` and delete the session themselves,
    // which was flaky: `page.goto()` resolves while the application is still booting,
    // and its auth bootstrap wrote the token back to localStorage right after the
    // clear. Not having a session is deterministic; destroying one is a race.
    //
    // It still depends on `setup`, because the account it signs in AS must exist.
    {
      name: 'bdd:app-anon',
      testDir: bddOutputDir,
      grep: /@signed-out/,
      dependencies: ['setup'],
      ...SERIALISED_WRITES, // sign-in is additionally rate limited by the app
      use: { ...devices['Desktop Chrome'], baseURL: APP },
    },
    // The portability lane: a different application, no auth, no download.
    {
      name: 'bdd:chromium',
      testDir: bddOutputDir,
      grepInvert: /@app/,
      use: { ...devices['Desktop Chrome'], baseURL: TODOMVC },
    },
    // The API lane: the same application over HTTP, with no browser at all. Signed in
    // as the account `setup` provisioned, so this session and the UI session are one
    // user — state seeded here is visible to the browser lanes.
    {
      name: 'api',
      testDir: './tests/api',
      dependencies: ['setup'],
      ...SERIALISED_WRITES,
      use: { baseURL: APP },
    },
    // Framework self-tests: hermetic, no application involved. They live in
    // framework-tests/ rather than tests/ so the split is visible in the file tree:
    // tests/ holds tests OF THE APPLICATION, framework-tests/ holds tests of this
    // framework's own helpers. No testIgnore needed — the directory says it.
    {
      name: 'chromium',
      testDir: './framework-tests',
      use: { ...devices['Desktop Chrome'], baseURL: TODOMVC },
    },
  ],
});
