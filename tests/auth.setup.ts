import { test as setup, request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LoginPage } from '../pages/LoginPage';
import { registerAccount } from '../features/step-definitions/support/demo-account';

/**
 * Authentication setup — runs once, before anything that needs a signed-in session.
 *
 * Provisions an account over the API, signs in through the real UI so that path is
 * genuinely exercised, and saves the session as a storageState artefact. Projects that
 * need a session declare `dependencies: ['setup']`, so no scenario signs in via the UI.
 */
const AUTH_FILE = path.join(__dirname, '../test-data/.auth/user.json');
const ACCOUNT_FILE = path.join(__dirname, '../test-data/.auth/account.json');

setup('authenticate', async ({ page }) => {
  const api = await request.newContext({ baseURL: process.env.APP_API_URL });
  const account = await registerAccount(api, `setup${Date.now()}`);
  await api.dispose();

  const loginPage = new LoginPage(page);
  await loginPage.login(account.username, account.password);
  await loginPage.expectSignedIn();

  // Reuse the token the UI login just created rather than signing in a second time
  // over the API. Two reasons, and the second is the one that bites:
  //  - the API lane then runs as literally the same session as the browser, not
  //    merely the same account;
  //  - the application rate-limits /login and /user/token/refresh from ONE bucket,
  //    ~8 per IP per minute, and the SPA spends most of it refreshing. Every login
  //    the suite does not need is budget the scenarios that TEST signing in can use.
  const apiToken = await page.evaluate(() =>
    (globalThis as unknown as { localStorage: Storage }).localStorage.getItem('token'),
  );
  if (!apiToken) throw new Error('signed in, but no token in localStorage — has the app changed how it stores it?');

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });

  // Publish the credentials for the scenarios that exercise signing in.
  //
  // One account per run, not one per scenario: the demo application stores its data in
  // SQLite, which serialises writes, so concurrent registrations fail with "database is
  // locked" (measured: 6 parallel registrations, 5 rejected). That is a property of the
  // application, and the framework's job is to work with it rather than generate load it
  // cannot serve. The file sits beside the storageState artefact and is git-ignored;
  // it holds a throwaway account on an ephemeral local instance.
  fs.writeFileSync(ACCOUNT_FILE, JSON.stringify({ ...account, apiToken }, null, 2));
});
