# New Client Onboarding — Certance Lens

> Estimated time to first green test run: **under 2 hours**  
> Audience: QA lead setting up the framework on a new client project

---

## Prerequisites checklist

Before you start, confirm you have:

- [ ] Node.js 20 LTS or later (`node --version`)
- [ ] A staging / test environment URL for the client application
- [ ] A test user account (email + password) that can be used in CI
- [ ] An invite to the client's GitHub repository (or permission to create one)
- [ ] Playwright browsers installable (internet or cached in CI)

---

## Step 1 — Copy the framework template (5 min)

```bash
# Option A: use the Certance GitHub template repo
gh repo create client-project-e2e --template certance-advisory/playwright-framework --private

# Option B: copy from local framework reference
cp -r "Certance 1.0" my-client-e2e
cd my-client-e2e
git init && git add . && git commit -m "chore: init from Certance framework v1"
```

---

## Step 2 — Install dependencies (3 min)

```bash
npm install
npx playwright install --with-deps chromium
```

For full cross-browser coverage in CI (takes longer):

```bash
npx playwright install --with-deps
```

---

## Step 3 — Configure environment (5 min)

```bash
cp .env.example .env
```

Edit `.env` with client-specific values:

```dotenv
BASE_URL=https://staging.client-app.com/
TEST_USER_EMAIL=qa-robot@client.com
TEST_USER_PASSWORD=<secret-from-password-manager>
APP_LIST_URL=https://staging.client-app.com/app/the-relevant-list-path
```

> Never commit `.env`. It is in `.gitignore`.  
> For CI: add these as GitHub Actions secrets.

---

## Step 4 — Replace the seed assertion (10 min)

`tests/seed.spec.ts` contains the post-login assertion that confirms the user
is successfully authenticated. This assertion is application-specific and
**must be updated** for every new client.

1. Open `tests/seed.spec.ts`
2. Replace the `expect()` call after login with a locator that is reliably
   visible after successful authentication on the client's app
3. Update `pages/BasePage.ts → assertWorkspaceLoaded()` to match the same element

```typescript
// seed.spec.ts — example for a CRM application
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });

// BasePage.ts — keep in sync with seed.spec.ts
async assertWorkspaceLoaded() {
  await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });
}
```

---

## Step 5 — Run the auth seed (2 min)

```bash
npm run test:seed
```

Expected output: 1 test passed. File `test-data/.auth/user.json` is created.

If this fails, double-check:

- `.env` values are correct
- The seed assertion locator in Step 4 matches the actual post-login page
- The staging environment is reachable

---

## Step 6 — Run the Planner agent (20 min)

> **First time in this environment?** Run the checks in
> [`AGENT_VERIFICATION.md`](AGENT_VERIFICATION.md) first — they confirm the
> planner → generator → healer pipeline is correctly wired before you rely on it.

The Planner reads `tests/seed.spec.ts` as context and maps the application's
user flows. It outputs a set of `plans/*.md` files for human review.

```bash
# In GitHub Copilot / Claude Code / Cursor:
# "Load the Planner agent and run it against [staging URL]"
# Then review the generated plans/*.md files with the client.
```

Alternatively, write the plans manually following the format in `plans/authentication.md`.

**Review step**: share the `plans/*.md` output with the client stakeholder.
Get sign-off on scope before generating tests. This is a key quality gate.

---

## Step 7 — Delete the reference-example Page Objects and features (15 min)

The framework ships with example Page Objects and features built against
the reference example (TodoMVC) for demonstration purposes. Replace them with
client-specific ones.

Files to **delete**:

```
pages/LoginPage.ts         ← recreate for client login UI
pages/TaskListPage.ts      ← replace with client's equivalent
pages/TaskCreateModal.ts   ← replace with client's equivalent
pages/TaskDetailPage.ts    ← replace with client's equivalent
pages/SearchModal.ts       ← replace with client's equivalent
features/authentication.feature
features/task-creation.feature
features/task-management.feature
features/list-views.feature
features/search.feature
features/step-definitions/
plans/authentication.md
plans/task-creation.md
plans/task-management.md
plans/list-views.md
plans/search.md
```

Keep (these are framework infrastructure, not app-specific):

```
pages/BasePage.ts          ← update assertWorkspaceLoaded() only
fixtures/index.ts
tests/seed.spec.ts         ← update assertion only
playwright.config.ts       ← no changes needed if using env vars
```

---

## Step 8 — Generate Page Objects with the Generator agent (30 min)

After the plans are approved:

```bash
# In GitHub Copilot / Claude Code / Cursor:
# "Load the Generator agent. Use plans/*.md to generate Page Objects
#  and BDD step definitions for [client app name]."
```

The Generator:

1. Opens the staging app in a browser
2. Inspects the DOM for stable locators
3. Creates `pages/[Feature]Page.ts` for each plan
4. Creates `features/[feature].feature` + `features/step-definitions/[feature].steps.ts`

Review the output. Run a quick sanity check:

```bash
npm run bdd:gen
npm run bdd:test
```

---

## Step 9 — Verify and commit (10 min)

```bash
npm run bdd:test          # smoke tests only on chromium
npm run bdd:test:all      # smoke + regression on all 3 browsers
npm run test:report       # open HTML report to review results
```

Commit clean:

```bash
git add .
git commit -m "feat: initial test suite for [client] v1"
```

---

## Step 10 — Set up CI (15 min)

Copy the GitHub Actions workflow to the client repository:

```bash
cp .github/workflows/playwright.yml  <client-repo>/.github/workflows/
cp .github/workflows/nightly.yml     <client-repo>/.github/workflows/
```

Add the following GitHub Actions secrets in the client repo settings:

- `BASE_URL`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`
- `APP_LIST_URL` (or equivalent)

Push and verify the workflow runs on the first commit.

---

## Troubleshooting

| Symptom                               | Likely cause                              | Fix                                     |
| ------------------------------------- | ----------------------------------------- | --------------------------------------- |
| `seed.spec.ts` fails with timeout     | Wrong locator in assertion                | Step 4 — update assertion               |
| `user.json` missing after seed        | Seed test was skipped or crashed          | Re-run `npm run test:seed`              |
| BDD gen fails: "no steps match"       | Step definition not registered            | Check `playwright.config.ts` steps glob |
| Tests pass locally, fail in CI        | Missing env vars in GitHub Secrets        | Add secrets to repository settings      |
| Flaky locators after deploy           | UI changed                                | Run Healer agent                        |
| `Cannot find module '../../fixtures'` | fixtures/index.ts not importing correctly | Check relative path depth               |

---

## Time budget summary

| Step                     | Time          |
| ------------------------ | ------------- |
| 1–5: Setup and seed      | ~25 min       |
| 6: Planner + plan review | ~20 min       |
| 7: Delete demo files     | ~15 min       |
| 8: Generator + review    | ~30 min       |
| 9–10: CI setup + commit  | ~25 min       |
| **Total**                | **~1h 55min** |
