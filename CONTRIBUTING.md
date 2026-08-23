# Contributing

Thanks for your interest in improving **Certance Lens**. This framework is opinionated on
purpose — contributions should keep it fast, readable and trustworthy.

## Getting set up

```bash
npm install
npx playwright install chromium
npm test          # every lane: the self-hosted app, its API, TodoMVC, self-tests
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

## Static analysis (SonarQube)

The repo is set up for SonarQube Cloud analysis, which runs inside the `unit` CI job and
reuses the coverage that job already produces. Configuration lives in
[`sonar-project.properties`](./sonar-project.properties).

**The scan skips itself until a `SONAR_TOKEN` secret exists**, so nothing is red before the
project is connected. It is also skipped for Dependabot and fork pull requests, which run with a
read-only token that cannot read secrets.

To connect it (maintainers): import the repository into SonarQube Cloud (free for public
repositories), set `sonar.organization` in `sonar-project.properties`, add the `SONAR_TOKEN`
secret, and turn **Automatic Analysis off** in the project's Analysis Method settings — it cannot
import coverage, and running it alongside CI analysis makes builds fail.

Two deliberate choices in the configuration:

- `pages/`, `fixtures/` and `utils/` are analysed as **source, not test code**. They are the
  product, so they should carry reliability, security and maintainability ratings.
- Those same paths are excluded from **coverage** only. They are exercised by a real browser
  through Playwright, never by unit tests, so counting them in the coverage denominator would
  make the gate noise instead of signal.

---

## Reporting security issues

Please do not open a public issue for security problems — see [SECURITY.md](./SECURITY.md).
