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
   (setup project)                                    (via storageState)
```

---

## 1. Setup project (`tests/auth.setup.ts`)

Authentication runs once, in its own project, before anything that needs a session.
Other projects declare `dependencies: ['setup']`, so no scenario ever signs in through
the UI.

```typescript
import { test as setup, expect, request } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const AUTH_FILE = 'test-data/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Provision an isolated account over the API, then sign in through the real UI so
  // that path is genuinely exercised.
  const api = await request.newContext({ baseURL: process.env.APP_API_URL });
  const created = await api.post('/users/register', { data: {/* ... */} });
  expect(created.status()).toBe(201);
  await api.dispose();

  const loginPage = new LoginPage(page);
  await loginPage.login(email, password);
  await loginPage.expectSignedIn();

  await page.context().storageState({ path: AUTH_FILE });
});
```

**Provision an account per run rather than sharing one.** Shared demo credentials lock
after repeated failed attempts by anyone using the same environment, and a suite built
on them fails for reasons unrelated to the code under test. An account the run creates
cannot be locked by someone else, and no credential enters the repository.

If the application cannot provision accounts over an API, fall back to injected
credentials from your secret manager — never a value committed to the repo.

**Update checklist for each new app:**

- [ ] Login form locators, behind a Page Object
- [ ] A reliable post-login assertion
- [ ] `BASE_URL`, and `APP_API_URL` if provisioning over an API

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

## 4. Auth scenarios — clearing cookies

Authentication feature tests (a `features/auth.feature` of your own) test the
login UI itself. They must clear the saved auth state before running:

```typescript
// features/step-definitions/authentication.steps.ts
Given('I am on the login page', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(process.env.BASE_URL + 'login');
  await page.evaluate(() => localStorage.clear()).catch(() => {});
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
});
```

This pattern ensures the auth test exercises the real login UI, even though
the BDD project injects `storageState` at startup.

---

## 5. Auth state expiry

Storage state files expire when session cookies expire. Signs of expiry:

- Tests that navigate to the app land on the login page instead of the app
- `assertWorkspaceLoaded()` times out

**Fix:** re-run the setup project (`npx playwright test --project=setup`), or simply
re-run the suite — the setup project runs first and refreshes the state.

The setup project is declared as a dependency of the projects that need it, so CI needs
no separate seed job — Playwright orders it automatically.

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
