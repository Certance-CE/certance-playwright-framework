import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage — sign-in for the demo application.
 *
 * Every locator here is role- or label-based. That is not luck: it is the reason this
 * application was chosen as the reference. An app whose controls have no accessible
 * names forces CSS selectors, and a framework whose headline is its locator discipline
 * should not ship a demo that breaks it.
 */
export class LoginPage extends BasePage {
  async open() {
    await this.goto('/login');
  }

  async login(username: string, password: string) {
    await this.open();
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByLabel('Password', { exact: true }).fill(password);
    await this.page.getByRole('button', { name: /log ?in/i }).click();
  }

  /**
   * The landing page greets the user by name and time of day, so the greeting is a poor
   * assertion. The task list beside it is stable.
   */
  async expectSignedIn() {
    await expect(this.page.getByRole('heading', { name: 'Current Tasks' })).toBeVisible({ timeout: 30_000 });
  }

  async expectStillOnSignIn() {
    await expect(this.page.getByRole('button', { name: /log ?in/i })).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole('heading', { name: 'Current Tasks' })).toHaveCount(0);
  }
}
