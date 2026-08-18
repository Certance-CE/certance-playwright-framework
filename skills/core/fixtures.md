# Fixtures and Hooks

Load this guide when: creating shared test setup, adding page object fixtures,
or designing cross-cutting test infrastructure.

---

## Core principle: fixtures over BeforeEach

Playwright fixtures are the **only** mechanism for shared test setup in this
framework. Never use `test.beforeEach()` for state that more than one spec
file needs. Never instantiate Page Objects manually inside test bodies.

```typescript
// ✅ Correct — Page Object injected via fixture
test('creates a task', async ({ taskListPage }) => {
  await taskListPage.openCreateTaskModal();
});

// ❌ Wrong — manual instantiation inside test
test('creates a task', async ({ page }) => {
  const listPage = new TaskListPage(page); // don't do this
  await listPage.openCreateTaskModal();
});

// ❌ Wrong — BeforeEach for login
test.beforeEach(async ({ page }) => {
  await page.goto('/login'); // don't do this — use storageState
});
```

---

## 1. Page Object fixtures (`fixtures/index.ts`)

The framework extends `playwright-bdd`'s base test with typed Page Object
fixtures. Every Page Object class maps to a fixture property.

```typescript
// fixtures/index.ts
import { test as base } from 'playwright-bdd';
import { LoginPage } from '../pages/LoginPage';
import { TaskListPage } from '../pages/TaskListPage';

type PageFixtures = {
  loginPage: LoginPage;
  taskListPage: TaskListPage;
  // add new Page Objects here
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  taskListPage: async ({ page }, use) => {
    await use(new TaskListPage(page));
  },
});

export const { expect } = test;
```

### Adding a new Page Object fixture

When you create a new Page Object (`pages/MyFeaturePage.ts`):

1. Import it in `fixtures/index.ts`
2. Add the type to `PageFixtures`
3. Add the fixture factory function

```typescript
// 1. Add type
type PageFixtures = {
  // ...existing
  myFeaturePage: MyFeaturePage;
};

// 2. Add factory
export const test = base.extend<PageFixtures>({
  // ...existing
  myFeaturePage: async ({ page }, use) => {
    await use(new MyFeaturePage(page));
  },
});
```

---

## 2. Fixture scope

Playwright fixtures can be scoped to `'test'` (default) or `'worker'`.

| Scope      | Lifetime                        | Use for                                       |
| ---------- | ------------------------------- | --------------------------------------------- |
| `'test'`   | One test function               | Page Objects, fresh browser state             |
| `'worker'` | All tests in one worker process | Expensive setup (DB connections, API clients) |

```typescript
// Worker-scoped fixture (runs once per worker, not per test)
export const test = base.extend<{}, { apiClient: ApiClient }>({
  apiClient: [
    async ({}, use) => {
      const client = await ApiClient.create(process.env.API_KEY!);
      await use(client);
      await client.destroy();
    },
    { scope: 'worker' },
  ],
});
```

---

## 3. Fixture teardown — cleanup after use

Use the `use()` / teardown pattern for setup that needs cleanup:

```typescript
export const test = base.extend<{ createdTaskId: string }>({
  createdTaskId: async ({ apiClient }, use) => {
    // Setup: create a task via API
    const task = await apiClient.createTask({ title: 'Temp task' });
    await use(task.id);
    // Teardown: delete the task after the test — runs even if test fails
    await apiClient.deleteTask(task.id);
  },
});
```

---

## 4. Using fixtures in BDD step definitions

Step definitions receive fixtures as their first parameter (destructured):

```typescript
import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

// Page Object fixture injected alongside built-in `page` fixture
When('I open the create task modal', async ({ taskListPage }) => {
  await taskListPage.openCreateTaskModal();
});

When('I fill in the task title {string}', async ({ taskCreateModal }, title: string) => {
  await taskCreateModal.fillTitle(title);
});
```

---

## 5. Fixture for test data generation

Add a `testData` fixture to generate synthetic data per test:

```typescript
// fixtures/index.ts
import { fake } from '../utils/test-data';

type PageFixtures = {
  // ...existing
  testData: typeof fake;
};

export const test = base.extend<PageFixtures>({
  // ...existing
  testData: async ({}, use) => {
    await use(fake);
  },
});
```

Usage:

```typescript
When('I create a task with a unique name', async ({ taskCreateModal, testData }) => {
  const title = testData.taskName();
  await taskCreateModal.fillTitle(title);
});
```

---

## 6. Auth fixture — multi-role

For tests that require a specific role, override the `storageState` via a
custom fixture rather than navigating to the login page:

```typescript
// fixtures/index.ts
type PageFixtures = {
  asAdmin: void; // marker fixture — sets admin storageState
};

export const test = base.extend<PageFixtures>({
  asAdmin: async ({ browser }, use) => {
    // This fixture is only invoked when a test requests it
    // Use a separate browser context with the admin auth state
    const context = await browser.newContext({
      storageState: 'test-data/.auth/admin.json',
    });
    await use();
    await context.close();
  },
});
```
