import { test } from '@playwright/test';
import path from 'path';
import { LoginPage } from '../pages/LoginPage';

/**
 * Auth seed — TEMPLATE (skipped by default).
 *
 * The TodoMVC reference example needs no login, so this does nothing out of the box.
 * For an app that DOES need auth: set TEST_USER_EMAIL / TEST_USER_PASSWORD in .env,
 * adapt `pages/LoginPage.ts` to your app, and run `npm run test:seed` once to capture
 * a storageState. Then point the bdd project at `test-data/.auth/user.json` in
 * playwright.config.ts (see skills/core/auth.md). Keep real credentials out of the
 * repo — inject them via env / CI secrets only.
 */
const AUTH_FILE = path.join(__dirname, '../test-data/.auth/user.json');

test('seed: authenticate and save storage state', async ({ page }) => {
  test.skip(!process.env.TEST_USER_EMAIL, 'Template — set TEST_USER_EMAIL and adapt LoginPage to your app.');

  // UI interactions live in the Page Object, not the spec (golden rules #1 and #2).
  const login = new LoginPage(page);
  await login.login(process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);
  await login.expectLoggedIn();

  await page.context().storageState({ path: AUTH_FILE });
});
