# Locator Strategy

Load this guide when: writing any selector, finding elements, or reviewing
locators for stability and reliability.

---

## The locator hierarchy — apply top to bottom

```
1. getByRole()          ARIA semantics — best resilience to UI changes
2. getByLabel()         form fields — tied to visible label text
3. getByTestId()        data-testid / data-test attributes added by devs
4. getByPlaceholder()   acceptable for inputs without a label
5. getByText()          last resort for non-interactive elements only
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✗ CSS selectors         BANNED — brittle, tied to markup
✗ XPath                 BANNED — brittle, unreadable
✗ .nth() on generic     BANNED unless absolutely unavoidable + commented
✗ class-based           BANNED — styling classes change constantly
```

---

## getByRole — the primary locator

Playwright's `getByRole()` queries by ARIA role and accessible name.
This mirrors how assistive technologies and users perceive elements.

```typescript
// Buttons
page.getByRole('button', { name: 'Submit' });
page.getByRole('button', { name: 'Save', exact: true });

// Links
page.getByRole('link', { name: 'Dashboard' });

// Headings
page.getByRole('heading', { name: 'Create Task', level: 2 });

// Textboxes (inputs with associated labels)
page.getByRole('textbox', { name: 'Email address' });

// Checkboxes and radio buttons
page.getByRole('checkbox', { name: 'Send notifications' });

// Menu items
page.getByRole('menuitem', { name: 'Log Out' });

// Dialog (modal)
page.getByRole('dialog', { name: 'Confirm deletion' });

// Table row
page.getByRole('row', { name: 'Task Alpha' });
```

### ARIA role reference (most common in web apps)

| Role            | Typical HTML element                |
| --------------- | ----------------------------------- |
| `button`        | `<button>`, `<input type="submit">` |
| `link`          | `<a href>`                          |
| `textbox`       | `<input type="text">`, `<textarea>` |
| `heading`       | `<h1>–<h6>`                         |
| `listitem`      | `<li>`                              |
| `checkbox`      | `<input type="checkbox">`           |
| `combobox`      | `<select>`, custom dropdown         |
| `dialog`        | modal / drawer overlay              |
| `menuitem`      | items inside `<menu>` or dropdown   |
| `option`        | items inside `<select>` or listbox  |
| `region`        | named `<section>` / `role="region"` |
| `complementary` | `<aside>`                           |
| `navigation`    | `<nav>`                             |
| `main`          | `<main>`                            |

---

## getByLabel — for form inputs

Use this when an input has a visible `<label>` element with matching text.
Playwright matches against the accessible label, whether it's a `<label>`,
`aria-label`, or `aria-labelledby`.

```typescript
page.getByLabel('Work email');
page.getByLabel('Password');
page.getByLabel('Due date');
```

---

## getByTestId — when role/label selectors are unstable

Request `data-testid` attributes from developer when:

- The element has no clear ARIA role
- Multiple elements share the same role and name
- The UI renders dynamic content with no stable text

Framework convention: `data-test` attribute (configured in `playwright.config.ts`)

```typescript
// playwright.config.ts
use: {
  testIdAttribute: 'data-test';
}

// In test code
page.getByTestId('create-task-button');
page.getByTestId('task-row-main__link');
page.getByTestId('status-list__in-progress');
```

Naming convention for `data-test` values: `[component]__[element]`

---

## Scoping locators — reduce ambiguity

When a page has multiple identical elements, scope to the container:

```typescript
// Scope to a dialog
const dialog = page.getByRole('dialog', { name: 'Create Task' });
await dialog.getByRole('textbox', { name: 'Task name' }).fill('My task');
await dialog.getByRole('button', { name: 'Create' }).click();

// Scope to a table row
const row = page.getByRole('row', { name: 'Alpha Project' });
await row.getByRole('button', { name: 'Edit' }).click();

// Scope to a sidebar
const sidebar = page.getByRole('complementary', { name: 'Task sidebar' });
await sidebar.locator('[contenteditable="true"]').click();
```

---

## Filtering locators

```typescript
// Has text
page.getByRole('listitem').filter({ hasText: 'Overdue' });

// Has nested element
page.getByRole('row').filter({ has: page.getByRole('checkbox') });

// Combine: row with specific text that also has a button
page.getByRole('row').filter({ hasText: 'Task Alpha' }).getByRole('button', { name: 'Delete' });
```

---

## When a stable locator does not exist

1. Check if another role/label locator works
2. Use `.filter({ hasText: '...' })` to narrow
3. Ask the developer to add `data-testid` to the element
4. Document the decision in a comment: `// data-testid requested — JIRA-1234`
5. As last resort, use a scoped `locator()` with a **CSS class that is a BEM
   semantic block name** (not utility/Tailwind classes) — but document it

---

## Anti-patterns — never do these

```typescript
// ❌ CSS selector
page.locator('.btn-primary');
page.locator('div.task-list > ul > li:first-child');

// ❌ XPath
page.locator('//button[@class="submit"]');

// ❌ nth-child without explanation
page.locator('button').nth(2);

// ❌ Text locator for interactive element
page.getByText('Submit'); // use getByRole('button', { name: 'Submit' }) instead

// ❌ Hard-coded IDs that are auto-generated
page.locator('#react-select-3-option-0');
```
