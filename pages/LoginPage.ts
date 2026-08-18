import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage — TEMPLATE Page Object for the auth-seed flow (tests/seed.spec.ts).
 *
 * The TodoMVC reference example needs no login, so this is a starting point:
 * adapt the locators to your own app's login form (role/label first, golden
 * rule #1). Keeping the interactions here — not in the spec — is the point: even
 * the auth seed obeys "all UI interaction lives in a Page Object".
 */
export class LoginPage extends BasePage {
  async login(email: string, password: string) {
    await this.goto('/');
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }

  async expectLoggedIn() {
    // Assert a reliable post-login element for your app before saving state.
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 30_000 });
  }
}
