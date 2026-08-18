import { Page, expect } from '@playwright/test';

/**
 * BasePage — shared, application-agnostic helpers every Page Object inherits.
 *
 * Keep only generic behaviour here (navigation, common assertions). Anything
 * specific to a page or component belongs in that page's own class under pages/.
 * Locators use the role/label/testid hierarchy (golden rule #1) — never CSS/XPath.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /** Navigate to a path relative to `baseURL` and wait for the DOM to be ready. */
  async goto(path = '/') {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectHeadingVisible(text: string) {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible({ timeout: 15_000 });
  }

  async clickButton(name: string) {
    await this.page.getByRole('button', { name }).click();
  }

  async expectButtonDisabled(name: string) {
    await expect(this.page.getByRole('button', { name })).toBeDisabled();
  }
}
