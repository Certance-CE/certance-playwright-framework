import { test as base } from 'playwright-bdd';
import { BasePage } from '../pages/BasePage';
import { TodoPage } from '../pages/TodoPage';

/**
 * Page Object fixtures — one entry per Page Object class.
 *
 * This file is the single source of truth for Page Object creation: tests and
 * step definitions never call `new PageClass(page)` directly. Add a fixture here
 * for every class you create under pages/.
 *
 * The TodoPage entry is the reference example (TodoMVC). When you retarget the
 * framework at your own app, register your Page Objects here in its place.
 */
export type PageFixtures = {
  basePage: BasePage;
  todoPage: TodoPage;
};

export const test = base.extend<PageFixtures>({
  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },
  todoPage: async ({ page }, use) => {
    await use(new TodoPage(page));
  },
});
