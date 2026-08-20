import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';
import { registerAccount, type TestAccount } from './support/toolshop-account';

const { Given, When, Then } = createBdd(test);

const ACCOUNT = 'account';
const read = (scenario: Map<string, unknown>): TestAccount => {
  const account = scenario.get(ACCOUNT) as TestAccount | undefined;
  if (!account) throw new Error('no account registered for this scenario');
  return account;
};

Given('I have a newly registered account', async ({ api, data, scenario, page }) => {
  // Provisioned over the API, so the sign-in under test is the only UI login.
  scenario.set(ACCOUNT, await registerAccount(api, data.email('example.invalid')));
  // The project injects a signed-in storageState; these scenarios exercise signing in,
  // so they start from a clean session.
  await page.context().clearCookies();
});

Given('I am signed in', async ({ loginPage, scenario }) => {
  const { email, password } = read(scenario);
  await loginPage.login(email, password);
  await loginPage.expectSignedIn();
});

When('I sign in with my credentials', async ({ loginPage, scenario }) => {
  const { email, password } = read(scenario);
  await loginPage.login(email, password);
});

When('I sign in with an incorrect password', async ({ loginPage, scenario }) => {
  await loginPage.login(read(scenario).email, 'definitely-not-the-password-9x');
});

When('I sign out', async ({ loginPage }) => {
  await loginPage.signOut();
});

Then('I should be signed in', async ({ loginPage }) => {
  await loginPage.expectSignedIn();
});

Then('I should see an invalid credentials message', async ({ loginPage }) => {
  await loginPage.expectLoginError();
});

Then('I should not be signed in', async ({ loginPage }) => {
  await loginPage.expectStillOnSignIn();
});

Then('I should be signed out', async ({ loginPage }) => {
  await loginPage.expectSignedOut();
});
