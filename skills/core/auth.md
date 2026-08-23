# Authentication Patterns

Load this guide when: setting up auth for a new app, adding multi-role
tests, or debugging auth state issues.

---

## Core principle: authenticate once, reuse everywhere

The most expensive and flaky part of a UI test suite is login UI interaction.
Certance eliminates this by capturing auth state once and reusing it for every
test in the suite.

```
auth.setup.ts  ──►  test-data/.auth/user.json  ──►  every dependent project
  (setup project)                                     (via storageState)
```

---

## 1. Setup project (`tests/auth.setup.ts`)

Authentication runs once, in its own project, before anything that needs a session. Other
projects declare `dependencies: ['setup']`, so no scenario signs in through the UI.

```typescript
import { test as setup, request } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const AUTH_FILE = 'test-data/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Provision an isolated account over the API, then sign in through the real UI so
  // that path is genuinely exercised rather than assumed.
  const api = await request.newContext({ baseURL: process.env.APP_API_URL });
  const account = await registerAccount(api);
  await api.dispose();

  const loginPage = new LoginPage(page);
  await loginPage.login(account.username, account.password);
  await loginPage.expectSignedIn();

  await page.context().storageState({ path: AUTH_FILE });
});
```

**One account per run, not one per scenario.** Provisioning is a write, and many applications
serialise writes — the reference app stores data in SQLite, where six parallel registrations
produced five `database is locked` failures. Create the account once in setup and share it.

**Watch the API base URL.** Playwright joins request paths as URLs, so a leading slash replaces
any path on the `baseURL`: `/register` against `https://host/api/v1` silently becomes
`https://host/register`. A single-page application serves its shell for unknown routes, so that
returns **200 with HTML** and no account is created — surfacing much later as "wrong password".
Set the API base URL to the origin, pass full paths, and assert the response shape, not just
`response.ok()`.

---

## 2. Injecting auth state into all tests

Auth state is injected at the project level in `playwright.config.ts`, not
inside individual tests:

```typescript
// playwright.config.ts
{
  name: 'bdd:chromium',
  testDir: bddOutputDir,
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'test-data/.auth/user.json',  // ← injected here
  },
},
```

All BDD scenarios in the `bdd:*` projects start in an authenticated state.
No login step is needed in `Background:` sections.

---

## 3. Multi-role auth state

For applications that test multiple user roles (admin, viewer, editor), create
separate seed specs and storage state files:

```typescript
// tests/seed-admin.spec.ts
const ADMIN_AUTH = path.join(__dirname, '../test-data/.auth/admin.json');
// ... seed with admin credentials → saves to admin.json

// tests/seed-viewer.spec.ts
const VIEWER_AUTH = path.join(__dirname, '../test-data/.auth/viewer.json');
// ... seed with viewer credentials → saves to viewer.json
```

```
test-data/
└── .auth/
    ├── user.json     default user (read/write)
    ├── admin.json    admin role
    └── viewer.json   read-only role
```

Add separate BDD projects in `playwright.config.ts`:

```typescript
{ name: 'bdd:admin',  testDir: bddOutputDir, use: { storageState: 'test-data/.auth/admin.json' } },
{ name: 'bdd:viewer', testDir: bddOutputDir, use: { storageState: 'test-data/.auth/viewer.json' } },
```

Tag relevant scenarios: `@as-admin`, `@as-viewer`  
Run selectively: `npx playwright test --project=bdd:admin --grep @as-admin`

---

## 4. Scenarios that test signing in — give them no session

Authentication scenarios (a `features/auth.feature` of your own) exercise the login
UI itself, so they cannot start from a signed-in session.

**Do not destroy the session inside the test.** Run them in a project that never
injects one:

```typescript
// playwright.config.ts
{
  name: 'bdd:app',                 // signed in
  grep: /@app/,
  grepInvert: /@signed-out/,       // sign-in scenarios can never land here
  dependencies: ['setup'],
  use: { storageState: 'test-data/.auth/user.json' },
},
{
  name: 'bdd:app-anon',            // no session at all
  grep: /@signed-out/,
  dependencies: ['setup'],         // the account must still exist to sign in AS
  use: {},                         // no storageState
},
```

The step then asserts the starting state rather than creating it:

```typescript
Given('I am signed out', async ({ loginPage }) => {
  await loginPage.open();
  await loginPage.expectStillOnSignIn();
});
```

### Why not just clear the storage

This framework shipped the clearing version, and it was **flaky** — masked in CI by
`retries: 2`, so the job stayed green while the test failed on first attempt:

```typescript
// The version that was wrong. Do not copy it.
await page.goto('/');
await page.evaluate(() => localStorage.clear());
await page.context().clearCookies();
```

Two separate traps are stacked here, and fixing only the first is what makes it
flaky rather than broken:

1. **Clearing cookies is not signing out.** Most single-page applications keep the
   token in `localStorage` — the reference app does. Clear only cookies and the user
   stays signed in, the login form never renders, and it looks like a broken locator.
2. **Clearing `localStorage` is not signing out either.** `page.goto()` resolves when
   the DOM is ready, while the application is still booting. Its auth bootstrap then
   writes the token **back** immediately after the clear. Measured on the reference
   app: `keys=["token"]` on the very next line after `localStorage.clear()`, and
   `/login` then redirected to the signed-in home. Whether the clear survives depends
   on how fast the machine is.

You are racing the application's own start-up, and you cannot win that race
reliably — only often enough to look fixed. Not having a session has no race in it.

**The general rule: a test that has to destroy state in order to begin is running in
the wrong project.** The same argument applies to destructive flows (§7).

---

## 4b. Budget your sign-ins — the limiter is shared

Applications rate-limit authentication, and the budget is usually smaller and wider
than you expect. Measured against the reference application:

| Question                   | Answer                                                        |
| -------------------------- | ------------------------------------------------------------- |
| Limit                      | ~8 requests per IP per ~60s                                   |
| Keyed by                   | **IP**, not username — a fresh account does not reset it      |
| Counts failures?           | **Yes.** A rejected password costs the same as a good one     |
| Counts ordinary API calls? | No. 40 authenticated requests cost nothing                    |
| Configurable?              | **No.** Setting `ratelimit.*` changed nothing; it is separate |

The trap is the last row of what shares that bucket: **`/user/token/refresh` draws on
it too**, and a single-page application refreshes constantly. Measured during one run:
12 refresh calls in 7 seconds, the last six already `429` — after which the scenarios
that actually sign in had no budget left and failed.

That failure does not look like a rate limit. It looks like a flaky login.

Three habits keep a suite inside the budget:

1. **Sign in once per run, not once per lane.** The setup project takes the token from
   the session the UI login already created (`localStorage`) rather than signing in
   again over the API. One login, and the API lane runs as literally the same session.
2. **Order the lanes.** Scenarios that sign in should run BEFORE lanes that keep a
   browser session alive and churn refreshes — in this repo, expressed as
   `dependencies: ['setup', 'bdd:app-anon']` so it cannot silently drift.
3. **Do not hunt flake with `--repeat-each`.** Against a rate-limited application it
   manufactures the failure it is meant to detect. Run the suite repeatedly instead.

---

## 5. Auth state expiry

Storage state files expire when session cookies expire. Signs of expiry:

- Tests that navigate to the app land on the login page instead of the app
- `assertWorkspaceLoaded()` times out

**Fix:** re-run the setup project (`npx playwright test --project=setup`), or just re-run the
suite — setup is a declared dependency and refreshes the state automatically.

Because setup is declared as a dependency of the projects that need it, CI needs no separate
seed job — Playwright orders it.

---

## 6. What storage state contains

The `user.json` file saved by `storageState()` contains:

- All cookies for the origin (session cookies, CSRF tokens, etc.)
- LocalStorage values for the origin
- SessionStorage values

It does **not** contain passwords. It is safe to treat as a temporary CI
artefact but **never commit it to version control**.

Add to `.gitignore`:

```
test-data/.auth/
```

---

## 7. Destructive scenarios — a throwaway session

Some scenarios are **session-destructive**: logout, delete/deactivate account,
change/reset password, revoke a session or token. Run against the shared
`storageState`, they revoke the account's session **server-side** and break auth
for the entire suite (every other test lands on `/login`), forcing a manual
re-seed. Never run them on the shared login.

If your app has such flows, isolate them **structurally** so they can never touch
the shared login. A robust pattern to add for your own app:

1. **Tag** the scenario `@destructive` in its `.feature` file.
2. Give the shared bdd project `grepInvert: /@destructive/` in
   `playwright.config.ts`, so it can _never_ run a destructive scenario — no matter
   what `--grep` a CI job or developer passes.
3. Add a second project (e.g. `bdd:destructive`) with `grep: /@destructive/` and
   its **own throwaway `storageState`** seeded from a _disposable_ account. Logging
   that account out never touches the shared login. Define it only when that state
   exists, so `@destructive` scenarios simply run nowhere until you opt in.

Seed the throwaway account exactly like the main one (§1), to a separate
`storageState` file. The throwaway session is single-use by nature — a logout
revokes it — so treat it as disposable and re-seed when needed.

> This isolation is an optional pattern to add for an app with destructive flows,
> not something the TodoMVC reference example ships — it has no login, so nothing
> to isolate.
