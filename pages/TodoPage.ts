import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * TodoPage — Page Object for the TodoMVC demo (https://demo.playwright.dev/todomvc).
 *
 * This is the reference example. It exists so `npm test` is green on a fresh clone
 * with no credentials. To test your own app, replace this class (and features/) with
 * Page Objects for your pages and point BASE_URL at it — the framework core does not
 * change (golden rule #12). Locators use role/placeholder/testid only.
 */
export class TodoPage extends BasePage {
  private newTodoInput() {
    return this.page.getByPlaceholder('What needs to be done?');
  }

  private items() {
    return this.page.getByTestId('todo-item');
  }

  private item(text: string) {
    return this.items().filter({ hasText: text });
  }

  async open() {
    // baseURL is the app origin; the TodoMVC demo lives under /todomvc/.
    await this.goto('/todomvc/');
  }

  async addTodo(text: string) {
    await this.newTodoInput().fill(text);
    await this.newTodoInput().press('Enter');
  }

  async toggle(text: string) {
    await this.item(text).getByRole('checkbox').click();
  }

  async filterBy(name: 'All' | 'Active' | 'Completed') {
    await this.page.getByRole('link', { name, exact: true }).click();
  }

  async clearCompleted() {
    await this.page.getByRole('button', { name: 'Clear completed' }).click();
  }

  async expectVisible(text: string) {
    await expect(this.item(text)).toBeVisible();
  }

  async expectNotVisible(text: string) {
    await expect(this.item(text)).toHaveCount(0);
  }

  async expectCompleted(text: string) {
    await expect(this.item(text).getByRole('checkbox')).toBeChecked();
  }

  async expectCount(n: number) {
    await expect(this.items()).toHaveCount(n);
  }
}
