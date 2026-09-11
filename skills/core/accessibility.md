# Accessibility Testing

> Status: **Fixture provided, self-tested against a stub.** `fixtures/a11y.fixture.ts`
> (`@axe-core/playwright`) ships and is exercised in `framework-tests/foundation.spec.ts`
> against hand-written HTML. It is not yet run against the reference application; wire
> `checkA11y` into your own scenarios to use it.

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
(set `false` to inspect without failing). See `framework-tests/foundation.spec.ts` for a
runnable offline example.

---

## Under the hood

The `checkA11y` fixture wraps [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm),
which is already a dev dependency, so there is nothing to install. Use the fixture shown
above rather than importing axe directly, so every scan reports to Allure the same way.

---

## Integration with BDD

```gherkin
@regression @a11y
Scenario: Dashboard meets WCAG AA
  Given I am logged in to the workspace
  Then the page should have no WCAG AA violations
```

```typescript
Then('the page should have no WCAG AA violations', async ({ checkA11y }) => {
  await checkA11y({ tags: ['wcag2aa'] });
});
```

---

## WCAG levels in scope

| Level        | Description         | Required for                          |
| ------------ | ------------------- | ------------------------------------- |
| WCAG 2.1 A   | Minimum baseline    | Every suite                           |
| WCAG 2.1 AA  | Standard compliance | Public-facing applications            |
| WCAG 2.1 AAA | Enhanced            | Specific regulatory requirements only |

---

## Reference

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core rules](https://github.com/dequelabs/axe-core/blob/master/doc/rule-descriptions.md)
