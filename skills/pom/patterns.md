# Page Object Model Patterns

Load this guide when: creating a new Page Object, extending BasePage,
designing reusable component objects, or reviewing POM conventions.

---

## Core rules

1. One class per page or major UI component
2. All locators live inside Page Objects — never in spec files or step definitions
3. Methods are **action-level** (`submitForm()`, not `getSubmitButton()`)
4. Page Objects may contain assertions for **state verification** of that component
5. Page Objects never navigate to other pages (except via `navigate()` method)
6. All classes extend `BasePage`

---

## 1. BasePage — the shared foundation

Every Page Object extends `BasePage`. Add helpers here that are used across
three or more Page Objects:

```typescript
// pages/BasePage.ts
import { Page, expect } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  /** Wait for initial DOM paint — use after goto() calls */
  async waitForApp() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Assert that the authenticated workspace has loaded.
   * UPDATE THIS for each client — it must match a reliable post-login element.
   */
  async assertWorkspaceLoaded() {
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });
  }
}
```

---

## 2. Standard Page Object structure

```typescript
// pages/ExamplePage.ts
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExamplePage extends BasePage {
  // ── Navigation ─────────────────────────────────────────────────────────
  async navigate(url?: string) {
    await this.page.goto(url ?? process.env.APP_LIST_URL!);
    await this.assertWorkspaceLoaded();
  }

  // ── Actions ────────────────────────────────────────────────────────────
  async openCreateModal() {
    await this.page.getByRole('button', { name: 'Create' }).click();
    await expect(this.page.getByRole('dialog')).toBeVisible();
  }

  async fillTitle(title: string) {
    await this.page.getByRole('textbox', { name: 'Title' }).fill(title);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Save' }).click();
    // Wait for the dialog to close — confirms server-side acceptance
    await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  }

  // ── Queries ────────────────────────────────────────────────────────────
  async getItemNames(): Promise<string[]> {
    return this.page.getByRole('listitem').allInnerTexts();
  }

  async isItemVisible(name: string): Promise<boolean> {
    try {
      await expect(this.page.getByRole('link', { name })).toBeVisible({ timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 3. Naming conventions

| What              | Convention                     | Example                                           |
| ----------------- | ------------------------------ | ------------------------------------------------- |
| Class name        | PascalCase + `Page` or `Modal` | `TaskListPage`, `CreateTaskModal`                 |
| File name         | same, `.ts` extension          | `TaskListPage.ts`, `CreateTaskModal.ts`           |
| Navigate method   | always `navigate(url?)`        | `await listPage.navigate()`                       |
| Action methods    | verb + noun                    | `openCreateModal()`, `fillTitle()`, `clickSave()` |
| Query methods     | `get`/`is`/`has` prefix        | `getTitle()`, `isVisible()`, `hasError()`         |
| Component objects | Component + component type     | `FilterPanel`, `Pagination`, `Sidebar`            |

---

## 4. Component Objects — reusable UI widgets

For UI components that appear on multiple pages (navigation bar, filter panel,
pagination, date picker), create a **Component Object** in `pages/components/`:

```typescript
// pages/components/FilterPanel.ts
import { Page, Locator, expect } from '@playwright/test';

export class FilterPanel {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('region', { name: 'Filter panel' });
  }

  async open() {
    await this.page.getByRole('button', { name: 'Filter' }).click();
    await expect(this.root).toBeVisible();
  }

  async setStatus(status: string) {
    await this.root.getByRole('button', { name: 'Status' }).click();
    await this.root.getByRole('option', { name: status }).click();
  }

  async apply() {
    await this.root.getByRole('button', { name: 'Apply' }).click();
    await expect(this.root).not.toBeVisible({ timeout: 5_000 });
  }
}
```

Compose component objects inside Page Objects:

```typescript
// pages/TaskListPage.ts
import { FilterPanel } from './components/FilterPanel';

export class TaskListPage extends BasePage {
  readonly filterPanel: FilterPanel;

  constructor(page: Page) {
    super(page);
    this.filterPanel = new FilterPanel(page);
  }
}
```

Usage in step definitions:

```typescript
When('I filter by status {string}', async ({ taskListPage }, status: string) => {
  await taskListPage.filterPanel.open();
  await taskListPage.filterPanel.setStatus(status);
  await taskListPage.filterPanel.apply();
});
```

---

## 5. Handling dynamic/multiple instances

When a page contains a dynamic list (e.g., rows in a table), scope locators
to the specific row rather than using `.nth()`:

```typescript
// ✅ Scope by row content
async clickEditForItem(itemName: string) {
  await this.page.getByRole('row', { name: itemName })
    .getByRole('button', { name: 'Edit' }).click();
}

// ❌ Avoid — fragile position-based
async clickEditForSecondItem() {
  await this.page.getByRole('button', { name: 'Edit' }).nth(1).click();
}
```

---

## 6. Assertion methods inside Page Objects

State verification that is **specific to a component** belongs in the Page Object:

```typescript
async assertErrorVisible(message: string) {
  await expect(
    this.page.getByRole('alert').filter({ hasText: message })
  ).toBeVisible({ timeout: 5_000 });
}

async assertTaskCount(count: number) {
  await expect(this.page.getByRole('listitem')).toHaveCount(count);
}
```

General business assertions (checking outcomes across pages) stay in step
definitions or spec files.

---

## 7. `pages/` folder structure

```
pages/
├── BasePage.ts           shared navigation + wait helpers
├── LoginPage.ts          authentication UI
├── [Feature]Page.ts      one class per page/section
├── [Feature]Modal.ts     modal dialogs
└── components/
    ├── FilterPanel.ts    reusable filter widget
    ├── Pagination.ts     reusable pagination widget
    └── Sidebar.ts        reusable side panel
```
