import fs from 'node:fs';
import path from 'node:path';
import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';
import type { DemoAccount } from './support/demo-account';

const { Given, When, Then } = createBdd(test);

const ACCOUNT_FILE = path.join(__dirname, '../../test-data/.auth/account.json');

/**
 * The account provisioned once by the setup project. Scenarios share it rather than each
 * creating their own: the application serialises writes, so parallel registrations fail.
 */
function account(): DemoAccount {
  if (!fs.existsSync(ACCOUNT_FILE)) {
    throw new Error(`no account found at ${ACCOUNT_FILE} — the setup project should run first`);
  }
  return JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8')) as DemoAccount;
}

Given('I am signed out', async ({ page }) => {
  // The project injects a signed-in storageState, and these scenarios exercise signing in,
  // so the session has to go first.
  //
  // Clearing cookies is not enough. This application keeps its JWT in localStorage, as most
  // single-page applications do, so cookie-only clearing leaves the user signed in and the
  // login form never appears — a confusing failure that looks like a broken locator. You
  // must be on the origin before localStorage is reachable.
  await page.goto('/');
  await page.evaluate(() => (globalThis as unknown as { localStorage: Storage }).localStorage.clear());
  await page.context().clearCookies();
});

When('I sign in with valid credentials', async ({ loginPage }) => {
  const { username, password } = account();
  await loginPage.login(username, password);
});

When('I sign in with an incorrect password', async ({ loginPage }) => {
  await loginPage.login(account().username, 'definitely-not-the-password-9x');
});

Then('I should be signed in', async ({ loginPage }) => {
  await loginPage.expectSignedIn();
});

Then('I should not be signed in', async ({ loginPage }) => {
  await loginPage.expectStillOnSignIn();
});
