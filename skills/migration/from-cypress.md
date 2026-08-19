# Migrating from Cypress

Load this guide when: migrating an existing Cypress test suite to the
Certance Playwright framework.

---

## Key conceptual shifts

| Cypress concept               | Playwright equivalent                                         |
| ----------------------------- | ------------------------------------------------------------- |
| `cy.get('.selector')`         | `page.getByRole()` / `page.getByTestId()`                     |
| `cy.contains('text')`         | `page.getByText()` / `page.getByRole(role, { name: 'text' })` |
| `cy.intercept()`              | `page.route()`                                                |
| `cy.fixture()`                | `test-data/` JSON files + `utils/test-data.ts`                |
| `Cypress.env()`               | `process.env.*`, read in `playwright.config.ts`               |
| `beforeEach` hooks            | Playwright fixtures                                           |
| `cy.session()`                | `storageState` in `playwright.config.ts`                      |
| `cypress.config.ts`           | `playwright.config.ts`                                        |
| `cypress/support/commands.ts` | Page Object methods in `pages/`                               |
| `.should('be.visible')`       | `await expect(locator).toBeVisible()`                         |

---

## Syntax translation guide

```javascript
// Cypress
cy.get('[data-cy="submit"]').should('be.visible').click();
cy.get('h1').should('contain', 'Dashboard');
cy.url().should('include', '/dashboard');
```

```typescript
// Playwright
await page.getByTestId('submit').click();
await expect(page.getByRole('heading', { level: 1 })).toContainText('Dashboard');
await expect(page).toHaveURL(/dashboard/);
```

---

## Network interception

```javascript
// Cypress
cy.intercept('GET', '/api/tasks', { fixture: 'tasks.json' }).as('getTasks');
cy.wait('@getTasks');
```

```typescript
// Playwright
import tasks from '../test-data/api-responses/tasks.json';

await page.route('**/api/tasks', (route) => route.fulfill({ status: 200, json: tasks }));
// No explicit wait needed — Playwright's auto-waiting handles network
```

---

## Authentication migration

```javascript
// Cypress — cy.session()
beforeEach(() => {
  cy.session('user', () => {
    cy.visit('/login');
    cy.get('[name=email]').type(Cypress.env('email'));
    cy.get('[name=password]').type(Cypress.env('password'));
    cy.get('[type=submit]').click();
  });
});
```

```typescript
// Playwright — storageState (run once, reuse everywhere)
// 1. Run: npm run test:seed  (saves test-data/.auth/user.json)
// 2. playwright.config.ts injects storageState into all bdd:* projects
// 3. No beforeEach needed — auth is already injected
```

---

## Migration timeline

| Week | Activity                                                   |
| ---- | ---------------------------------------------------------- |
| 1    | Set up Playwright framework, run seed, smoke test one page |
| 2–3  | Migrate highest-value test files (happy paths)             |
| 4–5  | Migrate edge cases and negative scenarios                  |
| 6    | Validate coverage parity; decommission Cypress             |

Use the Generator agent to accelerate migration — provide it with your
existing Cypress spec files as context and ask it to rewrite them using
Playwright + the Certance POM conventions.
