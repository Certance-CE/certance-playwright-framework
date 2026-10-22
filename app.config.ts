import os from 'node:os';
import path from 'node:path';
import { devices, type PlaywrightTestConfig, type Project } from '@playwright/test';

/**
 * The TARGET layer — everything about the application under test, and nothing else.
 *
 * playwright.config.ts is the framework core: reporters, timeouts, retries, the flake
 * policy and the framework's own self-tests. It does not know what it is testing. This
 * file tells it: where the application lives, how to start it, and which lanes run
 * against it. Retargeting the framework means replacing this file (plus pages/,
 * features/ and requirements/) — `npm run init` does exactly that — and the core does
 * not change (golden rule #12, ADR-003).
 *
 * What follows is the reference target: two applications, deliberately.
 *
 * APP is the showcase: a real third-party application with a login and an API, which the
 * suite starts itself. Running it locally rather than over the internet is what makes the
 * suite deterministic, offline-capable, and immune to a hosted demo deciding that CI looks
 * like a bot — which is exactly what happened when this ran against a public site.
 *
 * TODOMVC is the portability lane: no login, nothing to provision. It proves the framework
 * is not welded to one application, and needs no download.
 */
export type Target = {
  baseURL: string;
  webServer?: PlaywrightTestConfig['webServer'];
  projects: Project[];
};

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
// The TodoMVC lane is unaffected and stays fully parallel. Point BASE_URL at a server
// with a real database and this is the first thing to raise.
const SERIALISED_WRITES = { workers: 1 } as const;

const TODOMVC = 'https://demo.playwright.dev';
const AUTH_FILE = 'test-data/.auth/user.json';
const APP_BIN = process.platform === 'win32' ? '.bin\\vikunja.exe' : './.bin/vikunja';

/**
 * The target, given where the core generated the BDD specs. A function, not constants, so
 * the environment is read when the core calls it — after .env is loaded — not at import.
 */
export function target({ bddDir }: { bddDir: string }): Target {
  const APP_PORT = Number(process.env.APP_PORT) || 3456;
  const APP = process.env.BASE_URL || `http://127.0.0.1:${APP_PORT}`;

  // A database path unique to this run, so every run starts from an empty application and
  // no state leaks between runs. Determinism is a property we assert, not hope for.
  const APP_DB = path.join(os.tmpdir(), `certance-lens-${Date.now()}.db`);

  // The demo app's own API — used to provision an isolated account and seed data. The `api`
  // fixture hard-codes nothing; the demo's endpoint is supplied here and stays overridable.
  // The API origin, not a path. Playwright joins request paths as URLs, so a leading
  // slash replaces any path on the baseURL — `/register` against `…/api/v1` silently
  // becomes `/register` on the origin. Callers pass the full path instead.
  process.env.APP_API_URL ||= APP;

  return {
    baseURL: APP,
    // Starts the demo application for the run and stops it afterwards. Skipped entirely
    // when BASE_URL points somewhere else.
    webServer: process.env.BASE_URL
      ? undefined
      : {
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
        testDir: bddDir,
        grep: /@app/,
        // Scenarios that exercise signing IN cannot start from a signed-in session.
        grepInvert: /@signed-out/,
        // Ordered AFTER the sign-in lane, deliberately. The application rate-limits
        // /login and /user/token/refresh from a single bucket — roughly 8 per IP per
        // minute — and this lane's browser sessions spend most of it on refreshes
        // (measured: 12 refresh calls in 7 seconds, the last six already 429). Running
        // it first left the scenarios that actually sign in with no budget, which
        // showed up as a flaky login rather than as the rate limit it was.
        dependencies: ['setup', 'bdd:app-anon'],
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
        testDir: bddDir,
        grep: /@signed-out/,
        dependencies: ['setup'],
        ...SERIALISED_WRITES, // sign-in is additionally rate limited by the app
        use: { ...devices['Desktop Chrome'], baseURL: APP },
      },
      // The portability lane: a different application, no auth, no download.
      {
        name: 'bdd:chromium',
        testDir: bddDir,
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
    ],
  };
}
