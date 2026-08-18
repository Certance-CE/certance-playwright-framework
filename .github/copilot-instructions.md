# Copilot workspace instructions

This file applies automatically to every Copilot interaction in this repository.
It sets non-negotiable standards for both test code and documentation.

---

## Project identity

This is the **Certance Advisory Playwright Enterprise Framework** — a reference
implementation for AI-native test automation. The same framework is deployed at
enterprise client engagements including regulated financial institutions.

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
- Tags: `@smoke` (CI), `@regression` (nightly), `@wip` (excluded from CI)
- One test, one scenario — split compound tests

---

## Documentation

Documentation standards — arc42 structure, C4/Mermaid diagrams, audience
tagging, prose rules, confidentiality, and living-docs rules — are **path-scoped**
to `docs/**` in `.github/instructions/documentation.instructions.md`. They load
automatically when you edit docs, and are kept out of this always-loaded file so
test-code tasks stay token-lean.

---

## Agent selection guide

| Task                               | Agent                        |
| ---------------------------------- | ---------------------------- |
| Write or fix Playwright tests      | `playwright-test-generator`  |
| Heal broken locators               | `playwright-test-healer`     |
| Plan a test suite                  | `playwright-test-planner`    |
| Write or update documentation      | `technical-writer`           |
| Package framework for a new client | `framework-template-builder` |
