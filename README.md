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
npm run setup
npm test
```

`npm run setup` fetches a browser and a demo application; `npm test` then runs against **two**
applications and needs no credentials from you:

- **A self-hosted app** — the showcase. Playwright starts it, provisions an account over its API,
  signs in through the real UI, runs the suite and stops it. It is a real third-party application
  (open source, unmodified), so the DOM was not written for these tests — but it runs locally, so
  the suite works offline, behind a corporate proxy, and cannot be blocked by a hosted demo
  deciding your CI looks like a bot.
- **TodoMVC** — the portability lane. No login, no download; it proves the framework is not welded
  to one application.

Skip the setup step and the suite tells you exactly what to run rather than failing a dozen
scenarios. Node 22 or newer (`.nvmrc` pins what `nvm` picks).

To test **your** app, copy `.env.example` to `.env`, set `BASE_URL` to your app's origin, and
replace `pages/` and `features/` with your own (the framework core doesn't change).

---

## The opinionated rules — and why

Twelve rules. **Nine are enforced by lint**, and the lint rules are themselves
unit-tested so one that stops firing fails the build. The other three are not
statically decidable; [docs/GOLDEN_RULES.md](docs/GOLDEN_RULES.md) says which is which,
and why.

The value here isn't a Playwright wrapper; it's a set of conventions that keep a suite fast,
readable and trustworthy as it grows. Five of the twelve are enforced by ESLint at
`--max-warnings=0` (the lint rules are themselves unit-tested, so one that stops firing fails
the build); the rest are review conventions. [`skills/SKILL.md`](./skills/SKILL.md) says which is which.

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

## Working with AI agents

[AGENTS.md](AGENTS.md) is the single instruction file every AI coding agent reads —
the lanes, the enforced rules, the constraints of the application under test, and what
to run before opening a pull request. `.github/copilot-instructions.md` and the agent
briefs in `.github/agents/` point at it rather than restating it.

That is not tidiness for its own sake. The previous copy told agents to mock with
`page.route()` and to import faker directly, and the lint rules now reject both — an
instruction file that has drifted is worse than none, because it generates work that
fails review.

---

## Where the tests live

Four lanes, deliberately separate. If you open `tests/` and wonder where the rest
went, this is the map:

| Lane                     | Lives in                                               | Runs against            | Browser |
| ------------------------ | ------------------------------------------------------ | ----------------------- | ------- |
| **API**                  | `tests/api/*.api.spec.ts`                              | the demo app's REST API | no      |
| **App UI**               | `features/*.feature` → generated into `.features-gen/` | the demo app            | yes     |
| **Portability**          | the same `features/`, `@todos` scenarios               | TodoMVC                 | yes     |
| **Framework self-tests** | `framework-tests/`                                     | nothing — fully offline | yes     |

`tests/` holds tests **of the application**. `framework-tests/` holds tests of this
framework's own helpers, and needs no app, no network and no auth.

**The UI tests are generated.** You edit Gherkin in `features/*.feature`; running
`npm run bdd:gen` writes the runnable specs into `.features-gen/`. VS Code's Testing
panel lists the _generated_ files, so run that first or two thirds of the suite looks
missing. Every `test:*` and `bdd:*` script does it for you.

```bash
npm run test:api      # API lane — no browser, a few seconds
npm run test:app      # the demo app, signed in and signed out
npm run bdd:test      # TodoMVC — no download needed
npm run test:examples # framework self-tests, fully offline
npm run test:ui       # Playwright UI mode: time travel, watch, pick locator
npm run test:headed   # watch a real browser drive it
```

---

## Using this as a template

This repository is a GitHub template. **Use this template → Create a new repository**
gives you the framework with no history, ready to point at your own application.

What to do first, in order:

1. `npm install && npm run setup && npm test` — confirm it is green before you change
   anything, so a later failure is unambiguously yours.
2. Set `BASE_URL` to your application. The demo download is then skipped entirely, and
   the `@app` lane runs against you instead.
3. Replace `pages/` and `features/` — those two directories are the only
   application-specific ones. `fixtures/`, `utils/` and `skills/` are the reusable
   core, and lint enforces that they stay that way.
4. Rewrite `requirements/*.md` for your own requirements, or delete them and let the
   matrix report zero until you do. An empty matrix is honest; a stale one is not.
5. Keep `framework-tests/` — they test the machinery you have just inherited, and they
   need no application at all.

`AGENTS.md` is worth reading even if you do not use AI agents: it is the shortest
accurate description of how the repository is laid out.

---

## Retargeting to your app

The core is application-agnostic by design (see
[ADR-003](./docs/decisions/ADR-003-app-agnostic-design.md)). To adopt it:

1. Set `BASE_URL` in `.env` to your app's origin.
2. Write Page Objects in `pages/` and register them in `fixtures/pages.fixture.ts`.
3. Write `.feature` files and step definitions in `features/`.
4. If your app needs a login, capture a `storageState` once and wire it into the bdd project in
   `playwright.config.ts` — see [`skills/core/auth.md`](./skills/core/auth.md).

`features/auth.feature` with `LoginPage` and `tests/auth.setup.ts` is the example to model an
authenticated app on; `TodoPage` + `features/todos.feature` is the minimal one.

---

## Built by Certance Advisory

A quality-engineering framework by [Certance Advisory](https://www.certance.eu/). Contributions
welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

MIT licensed ([LICENSE](./LICENSE)); third-party attributions in [NOTICE](./NOTICE).
