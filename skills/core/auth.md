# Authentication Patterns

Load this guide when: setting up auth for a new app, adding multi-role
tests, or debugging auth state issues.

---

## Core principle: authenticate once, reuse everywhere

The most expensive and flaky part of a UI test suite is login UI interaction.
Certance eliminates this by capturing auth state once and reusing it for every
test in the suite.

```
seed.spec.ts  ──►  test-data/.auth/user.json  ──►  all BDD projects
                                                    (via storageState)
```

---

## 1. Seed script (`tests/seed.spec.ts`)

The seed spec fills the login form **once** and saves the resulting cookies and
localStorage to a JSON file. It runs before the test suite and is not a real
test — it's infrastructure.

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../test-data/.auth/user.json');

test('seed: authenticate and save storage state', async ({ page }) => {
  await page.goto(process.env.BASE_URL!);
  await page.waitForLoadState('domcontentloaded');

  // ── Fill login form ──────────────────────────────────────────────────────
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.TEST_USER_EMAIL!);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Log In' }).click();

  // ── Confirm successful login before saving state ─────────────────────────
  // UPDATE THIS ASSERTION for each app under test — it must match a reliable
  // post-login element in the app.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
```

**Update checklist for each new app:**

- [ ] Login form locators (email, password, submit button)
- [ ] Post-login assertion (`getByRole('heading', { name: '...' })` or equivalent)
- [ ] `BASE_URL` environment variable

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

Authentication feature tests (`features/authentication.feature`) test the
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

**Fix:** Re-run the seed: `npm run test:seed`

In CI, run the seed job before every test job (see `.github/workflows/playwright.yml`).

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

The framework isolates them **structurally**, not by convention:

1. **Tag** the scenario `@destructive` in its `.feature` file.
2. The shared **`bdd:chromium`** project has `grepInvert: /@destructive/`, so it
   can _never_ run a destructive scenario — regardless of any `--grep` a CI job or
   developer passes. This is what makes the whole suite (including a manual
   regression dispatch) safe to run.
3. A separate **`bdd:destructive`** project runs _only_ `@destructive` scenarios,
   against its **own throwaway `storageState`** (`test-data/.auth/destructive.json`,
   a disposable account). Logging _it_ out never touches the shared login. The
   project is defined only when that state exists — otherwise `@destructive`
   scenarios run nowhere.

### Seeding the throwaway session

Use a **separate, disposable** account (not the shared one). Log it in and save +
trim its state to `destructive.json`, then run the isolated project:

```bash
# 1. Log the throwaway account in and save its state (headed so you can pass reCAPTCHA)
#    — mirror tests/auth.spec.ts but with the throwaway creds and this output path.
# 2. Trim it (a real app's storage state can be several MB; see scripts/trim-storage-state.js):
node scripts/trim-storage-state.js test-data/.auth/destructive.json
# 3. Run logout (and any other @destructive scenario) in isolation:
npm run bdd:destructive
```

For CI, base64 the trimmed `destructive.json` into the **`STORAGE_STATE_DESTRUCTIVE_BASE64`**
secret. The opt-in `bdd-destructive` job (manual dispatch only) decodes it and runs
the isolated project; without the secret it skips cleanly and the shared login is
never touched.

> The throwaway session is single-use by nature — running logout revokes it, so
> re-seed it before the next destructive run. That is the cost of testing real
> logout under reCAPTCHA-gated login, contained to a disposable account.
