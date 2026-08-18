# Component Objects

Load this guide when: creating reusable UI component abstractions that appear
on multiple pages (navigation bars, filter panels, pagination, date pickers).

---

## When to create a Component Object

Create a Component Object (not a full Page Object) when:

- The same UI widget appears on three or more pages
- The widget has its own complex interaction pattern
- You find yourself duplicating the same locator+action code in multiple Page Objects

---

## Structure

```typescript
// pages/components/FilterPanel.ts
import { Page, Locator, expect } from '@playwright/test';

export class FilterPanel {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    // Root locator scopes all child locators to this component
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

  async clear() {
    await this.root.getByRole('button', { name: 'Clear filters' }).click();
  }
}
```

---

## Composing into Page Objects

```typescript
// pages/TaskListPage.ts
import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { FilterPanel } from './components/FilterPanel';
import { Pagination } from './components/Pagination';

export class TaskListPage extends BasePage {
  readonly filterPanel: FilterPanel;
  readonly pagination: Pagination;

  constructor(page: Page) {
    super(page);
    this.filterPanel = new FilterPanel(page);
    this.pagination = new Pagination(page);
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

## Common Component Objects for enterprise applications

| Component        | File                           | Used by                     |
| ---------------- | ------------------------------ | --------------------------- |
| `FilterPanel`    | `components/FilterPanel.ts`    | List views, reports         |
| `Pagination`     | `components/Pagination.ts`     | Any paginated list          |
| `DatePicker`     | `components/DatePicker.ts`     | Forms, scheduling           |
| `ConfirmDialog`  | `components/ConfirmDialog.ts`  | Delete, destructive actions |
| `Notification`   | `components/Notification.ts`   | Toast/snackbar assertions   |
| `NavigationMenu` | `components/NavigationMenu.ts` | Sidebar / top nav           |
| `SearchInput`    | `components/SearchInput.ts`    | In-page search fields       |
