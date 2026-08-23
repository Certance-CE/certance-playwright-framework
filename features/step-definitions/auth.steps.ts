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

Given('I am signed out', async ({ loginPage }) => {
  // Nothing to tear down: @signed-out scenarios run in a project that injects no
  // storageState, so the browser starts with no session at all.
  //
  // This used to clear localStorage and cookies on a signed-in page, and it was
  // FLAKY — masked in CI by `retries: 2`. `page.goto()` returns when the DOM is
  // ready, while the application is still booting; its auth bootstrap then wrote
  // the token back into localStorage immediately after the clear, and /login
  // redirected to the signed-in home. Whether the clear survived depended on how
  // fast the machine was.
  //
  // The lesson is structural, not a better clear: a test that has to destroy state
  // in order to begin is running in the wrong project. Isolate at the project
  // level — the same argument skills/core/auth.md §7 makes for destructive flows.
  await loginPage.open();
  await loginPage.expectStillOnSignIn();
});

Given('I am signed in', async ({ loginPage, page }) => {
  // The project injects the session the setup project saved, so this asserts the
  // starting state rather than creating it.
  await page.goto('/');
  await loginPage.expectSignedIn();
});

When('I reload the page', async ({ page }) => {
  await page.reload();
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

When('I sign out', async ({ loginPage }) => {
  // Safe to run in the shared lane, and that is a MEASURED claim rather than an
  // assumption: this application's sign-out is client-side, so it clears the browser
  // session without revoking the token server-side. See tests/api/session.api.spec.ts,
  // which pins that behaviour, and skills/core/auth.md §7 for when it is NOT safe.
  await loginPage.signOut(account().username);
});

Then('returning to the workspace should land on the sign-in form', async ({ page, loginPage }) => {
  await page.goto('/');
  await loginPage.expectSignedOut();
});
