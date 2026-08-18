# Copilot workspace instructions

This file applies automatically to every Copilot interaction in this repository.
It sets non-negotiable standards for both test code and documentation.

---

## Project identity

This is **Certance Lens** — a general, opinionated Playwright + BDD framework for
AI-native test automation. The runnable reference example targets the public TodoMVC
demo; the core is application-agnostic, so you point `BASE_URL` at your own app.

Tech stack: Playwright · TypeScript · BDD (Cucumber) · GitHub Actions · Allure

---

## Test code — golden rules (non-negotiable)

- Locators: `getByRole()` > `getByLabel()` > `getByTestId()` — no CSS, no XPath
- Assertions: web-first only — `expect(locator).toBeVisible()`, never `waitForTimeout()`
- Auth: always use the auth fixture from `fixtures/` — never inline login in a spec
- Page Objects: all UI interactions go in `pages/` — no raw `page.click()` in spec files
- Test data: faker for synthetic data — never real PII in tests
- Mocking: `page.route()` for all external APIs — no real third-party calls in tests
- Read `skills/SKILL.md` before generating any test code
- BDD: write Gherkin in `features/*.feature`, steps in `features/step-definitions/`
- Run `npm run bdd:gen` before running BDD tests
- Tags: `@smoke` and `@regression` run in CI; `@wip` is excluded
- One test, one scenario — split compound tests

---

## Agent selection guide

| Task                          | Agent                       |
| ----------------------------- | --------------------------- |
| Write or fix Playwright tests | `playwright-test-generator` |
| Heal broken locators          | `playwright-test-healer`    |
| Plan a test suite             | `playwright-test-planner`   |
