# Contributing

Thanks for your interest in improving **Certance Lens**. This framework is opinionated on
purpose — contributions should keep it fast, readable and trustworthy.

## Getting set up

```bash
npm install
npx playwright install chromium
npm test          # BDD suite against the TodoMVC demo
npm run test:unit # framework unit tests
```

Git hooks (lint + format on staged files) are wired automatically via `npm install`
(`core.hooksPath = .githooks`).

## Before you open a PR

Run the same gates CI runs:

```bash
npm run lint        # golden rules + Playwright ESLint rules
npm run typecheck
npm run test:unit
npm run bdd:smoke   # or `npm test` for the full BDD suite
```

## The rules a change must follow

- **Locators**: `getByRole()` → `getByLabel()` → `getByTestId()`. No CSS selectors or XPath. If a
  stable locator doesn't exist, add a `data-testid` in the app rather than reaching for CSS.
- **Page Objects**: all UI interaction lives in `pages/`. No `page.click()`/`page.fill()` in specs.
- **Fixtures**: auth, data and shared setup come from `fixtures/` — never inline in a test.
- **Assertions**: web-first only (`expect(locator).toBeVisible()`). No `waitForTimeout()`.
- **External calls**: mock third parties at the network layer (`page.route()`).
- **Test data**: synthetic via faker. Never commit real PII, credentials or production data.
- **One scenario per test.** Clean up anything a test creates via the `cleanup` fixture.

## Commit & PR

- Keep PRs focused; one concern per PR.
- Write a clear description of what changed and why.
- Green CI (lint, unit, BDD) is required before merge.

## Reporting security issues

Please do not open a public issue for security problems — see [SECURITY.md](./SECURITY.md).
