import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage — sign-in for the reference application (Toolshop).
 *
 * Demonstrates the locator hierarchy against a real DOM nobody wrote for us:
 * `getByLabel` where the form has a proper `<label for>`, `getByTestId` where the
 * accessible name is ambiguous. Note the password field specifically — the page also
 * has a "Forgot your Password?" link whose aria-label contains "Password", so
 * `getByLabel('Password')` is a strict-mode violation. That is exactly the kind of
 * thing you only find by running against an app you do not control.
 */
export class LoginPage extends BasePage {
  async open() {
    await this.goto('/auth/login');
  }

  async login(email: string, password: string) {
    await this.open();
    await this.page.getByLabel('Email address').fill(email);
    await this.page.getByTestId('password').fill(password);
    await this.page.getByTestId('login-submit').click();
  }

  /** The account page is the post-login landing; its heading is the stable signal. */
  async expectSignedIn() {
    await expect(this.page.getByRole('heading', { name: 'My account' })).toBeVisible({ timeout: 30_000 });
  }

  /** After signing out the header offers sign-in again. */
  async expectSignedOut() {
    await expect(this.page.getByTestId('nav-sign-in')).toBeVisible({ timeout: 30_000 });
  }

  /**
   * After rejected credentials the user is still on the sign-in form. Asserting that
   * directly is more precise than checking a header link: it says the attempt did not
   * proceed, which is the behaviour under test.
   */
  async expectStillOnSignIn() {
    await expect(this.page.getByTestId('login-submit')).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole('heading', { name: 'My account' })).toHaveCount(0);
  }

  /**
   * The failure message is a bare `<div class="help-block">` — no role, no aria-live,
   * no test id. `getByText` is the only compliant locator available, which is legitimate
   * here precisely because it sits behind a Page Object rather than in a spec.
   *
   * Worth noting as a finding about the application, not the test: an error that carries
   * no ARIA role is never announced to a screen reader.
   */
  async expectLoginError() {
    await expect(this.page.getByText('Invalid email or password')).toBeVisible({ timeout: 20_000 });
  }

  /** The signed-in user's name doubles as the account menu trigger. */
  async signOut() {
    await this.page.getByTestId('nav-menu').click();
    await this.page.getByTestId('nav-sign-out').click();
  }
}
