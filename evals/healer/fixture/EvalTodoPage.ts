import type { Locator, Page } from '@playwright/test';

/** The eval case's Page Object: copied to pages/ in a throwaway worktree, never run in the suite. */
export class EvalTodoPage {
  readonly input: Locator;
  readonly addButton: Locator;
  readonly items: Locator;

  constructor(page: Page) {
    this.input = page.getByLabel('New task');
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.items = page.getByRole('listitem');
  }

  async add(text: string): Promise<void> {
    await this.input.fill(text);
    await this.addButton.click();
  }
}
