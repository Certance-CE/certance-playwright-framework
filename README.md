# Certance Lens

**The Certance Playwright + BDD framework for web apps.** A general, opinionated
test-automation framework that ships with a runnable example against the public
[TodoMVC demo](https://demo.playwright.dev/todomvc), so `npm test` is green on a fresh
clone — then you point `BASE_URL` at your own app and swap in your own Page Objects.

[![CI](https://github.com/Certance-CE/certance-playwright-framework/actions/workflows/playwright.yml/badge.svg)](https://github.com/Certance-CE/certance-playwright-framework/actions/workflows/playwright.yml)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](./LICENSE)

---

## Quick start (works on a cold clone)

```bash
git clone https://github.com/Certance-CE/certance-playwright-framework.git
cd certance-playwright-framework
npm install
npx playwright install chromium
npm test
```

That runs the BDD suite against the TodoMVC demo — no account, no secrets. To test **your**
app, copy `.env.example` to `.env`, set `BASE_URL` to your app's origin, and replace `pages/`
and `features/` with your own (the framework core doesn't change).

---

## The opinionated rules — and why

The value here isn't a Playwright wrapper; it's a set of conventions that keep a suite fast,
readable and trustworthy as it grows. They're enforced in review and, where possible, by ESLint.

| Rule                                                                                           | Why it matters                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Locators: `getByRole` → `getByLabel` → `getByTestId` → `getByPlaceholder`, never CSS/XPath** | Tests bind to what a user perceives, not to brittle DOM structure. When the markup changes but behaviour doesn't, the test still passes. |
| **All UI interaction lives in Page Objects (`pages/`)**                                        | No `page.click()` in specs. One place to update when a screen changes; specs read like intent.                                           |
| **Auth, data and setup come from fixtures — never inline**                                     | No logging in inside a test, no copy-pasted setup. State is injected, so tests stay independent and parallel-safe.                       |
| **Web-first assertions only — no `waitForTimeout`/sleeps**                                     | `expect(locator).toBeVisible()` retries until true or times out. Arbitrary sleeps are the #1 source of flake.                            |
| **Mock third parties at the network layer**                                                    | Payment/identity/analytics calls are stubbed via `page.route()`. No real external calls in a test run.                                   |
| **Synthetic data only (faker) — never real PII**                                               | Nothing sensitive in the repo, snapshots or CI.                                                                                          |
| **One scenario per test; clean up what you create**                                            | Compound tests hide failures; a `cleanup` fixture disposes any record a test creates so a shared account never accumulates junk.         |

See [`skills/SKILL.md`](./skills/SKILL.md) for the full knowledge base (locators, fixtures,
mocking, auth, accessibility, mutation testing, CI).

---

## What's in the box

- **BDD** via [`playwright-bdd`](https://github.com/vitalets/playwright-bdd) — Gherkin `features/`
  compiled to Playwright specs.
- **Fixtures** (`fixtures/`) — Page Objects, synthetic `data`, `network` mocking + fault
  injection, `a11y` (axe-core), an `api` request context, `cleanup` disposers, and `perf` (Core
  Web Vitals) — all reachable from one `test` object.
- **Contract checks** — validate API responses against a schema (`utils/contract.ts`, zod).
- **Accessibility, visual and performance** helpers in `utils/`.
- **Unit + mutation testing** (Vitest + StrykerJS) over the framework's own logic.
- **CI** (GitHub Actions) — lint, unit + mutation, and the BDD suite.
- **An AI-agent skills base** (`skills/`) so AI assistants generate tests that follow the rules.

Architecture overview: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) ·
decisions in [`docs/decisions/`](./docs/decisions).

---

## Retargeting to your app

The core is application-agnostic by design (see
[ADR-003](./docs/decisions/ADR-003-app-agnostic-design.md)). To adopt it:

1. Set `BASE_URL` in `.env` to your app's origin.
2. Write Page Objects in `pages/` and register them in `fixtures/pages.fixture.ts`.
3. Write `.feature` files and step definitions in `features/`.
4. If your app needs a login, capture a `storageState` once and wire it into the bdd project in
   `playwright.config.ts` — see [`skills/core/auth.md`](./skills/core/auth.md).

The TodoMVC `TodoPage` + `features/todos.feature` are the reference example to model yours on.

---

## Built by Certance Advisory

A quality-engineering framework by [Certance Advisory](https://www.certance.eu/). Contributions
welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).
