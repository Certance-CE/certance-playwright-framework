# Accessibility Testing

> Status: **Implemented** — `fixtures/a11y.fixture.ts` (`@axe-core/playwright`).

Load this guide when: adding WCAG compliance checks to the suite.

## Implementation — the `checkA11y` fixture

The `checkA11y(opts?)` fixture runs an axe scan on the current page, attaches
violations to the Playwright report **and** to Allure under an **"Accessibility"**
epic, and soft-fails on any violation (unless `failOn: false`).

```typescript
import { test } from '../fixtures';

test('dashboard meets WCAG 2.1 AA', async ({ page, checkA11y }) => {
  await page.goto('/dashboard');
  await checkA11y(); // whole page, WCAG A + AA
  await checkA11y({ include: 'main', exclude: '#third-party-widget' });
});
```

Options: `tags` (WCAG tag set), `include`/`exclude` (CSS region), `failOn`
(set `false` to inspect without failing). See `tests/foundation.spec.ts` for a
runnable offline example.

---

## Recommended tool: axe-core via @axe-core/playwright

```bash
npm install --save-dev @axe-core/playwright
```

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('dashboard has no accessibility violations', async ({ page }) => {
  await page.goto('/dashboard');
  await injectAxe(page);
  await checkA11y(page, undefined, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
  });
});
```

---

## Integration with BDD

```gherkin
@regression @a11y
Scenario: Dashboard meets WCAG AA
  Given I am logged in to the workspace
  Then the page should have no WCAG AA violations
```

```typescript
Then('the page should have no WCAG AA violations', async ({ page }) => {
  await injectAxe(page);
  await checkA11y(page, undefined, { runOnly: { type: 'tag', values: ['wcag2aa'] } });
});
```

---

## WCAG levels in scope

| Level        | Description         | Required for                                   |
| ------------ | ------------------- | ---------------------------------------------- |
| WCAG 2.1 A   | Minimum baseline    | All client engagements                         |
| WCAG 2.1 AA  | Standard compliance | Public-facing applications, financial services |
| WCAG 2.1 AAA | Enhanced            | Specific regulatory requirements only          |

---

## Reference

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core rules](https://github.com/dequelabs/axe-core/blob/master/doc/rule-descriptions.md)
