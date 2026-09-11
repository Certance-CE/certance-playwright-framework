# Certance Lens

**A Playwright and BDD framework for teams whose green build no longer tells them what is actually tested.**

A passing suite is not the same as a tested product. A test can drive a whole screen and assert nothing. Line coverage counts code that ran, not behaviour that was checked. And once an assistant writes a good share of your tests, "the build is green" stops being evidence on its own.

Certance Lens is a UI and API framework built on one commitment: every claim it makes about your coverage is something you can run and check. Conventions are enforced by the linter, not a style guide. Requirements are traced to the tests that exercise them. The framework's own logic is held to a mutation-testing bar. And the whole suite runs against a real application on a fresh clone, so none of this is theory.

[![CI](https://github.com/Certance-CE/certance-playwright-framework/actions/workflows/playwright.yml/badge.svg)](https://github.com/Certance-CE/certance-playwright-framework/actions/workflows/playwright.yml)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](./LICENSE)

---

## Every claim here is a command

The framework's whole argument is evidence over green, so this README holds itself to the same rule. Each line below is checkable on your own machine in under a minute. Nothing here asks you to take an adjective on trust.

**After `npm install`** (no application needed):

| Claim | Run |
| ----- | --- |
| Nine of the twelve rules fail the build, not the review | `npm run lint` |
| Each of those rules is unit-tested against code that breaks it, so a rule that quietly stops firing fails the build | `npm run test:unit` |
| The framework's own pure logic survives mutation testing at 70 percent | `npm run test:mutation` |

**After `npm run setup`** (starts a real application locally):

| Claim | Run |
| ----- | --- |
| The suite runs against a real app whose DOM was not written for these tests, signed in and signed out | `npm run test:app` |
| API responses are checked against a schema, so a backend change is caught here rather than in production | `npm run test:api` |
| Every catalogued requirement is traced to a test, reported as a matrix | `npm run coverage:requirements` |
| A test that fails and then passes on retry fails the build | `failOnFlakyTests` in `playwright.config.ts` |

The contract lane found a real inconsistency in the application under test on its first live run. It is pinned by a characterisation test rather than smoothed over. That is the behaviour this framework argues for: a suite that records what is true, including the awkward parts, instead of a number that flatters everyone.

---

## Quick start

```bash
git clone https://github.com/Certance-CE/certance-playwright-framework.git
cd certance-playwright-framework
npm install
npm run setup     # fetches a browser and a small open-source app
npm test          # 42 tests, about 30 seconds, no credentials
```

Node 22 or newer (`.nvmrc` pins what `nvm` picks). No accounts, no API keys, nothing to sign up for. Skip the setup step and the suite tells you what to run rather than failing a dozen scenarios.

**What `npm test` actually runs.** Playwright starts a real open-source application on your machine, registers an account through its API, signs in through the real login form, and tests it end to end, browser and API. A second public application (TodoMVC) runs a few of the same scenarios to show the framework is not welded to one product. Running the app locally is deliberate: the suite works offline, works behind a corporate proxy, and cannot break because a hosted demo changed or decided your CI looks like a bot.

---

## Point it at your application

Two directories are yours. Everything else stays as shipped, and the linter keeps it that way.

| Directory | What goes in it |
| --------- | --------------- |
| `pages/` | one Page Object class per screen: how to find and operate its controls |
| `features/` | the scenarios you want tested, in Gherkin your stakeholders can read |

Copy `.env.example` to `.env`, set `BASE_URL` to your app's origin, and replace those two directories. The reusable core (`fixtures/`, `utils/`, `skills/`) does not change, and a lint rule fails the build if an application name leaks into it, so the separation cannot erode by accident. The full walkthrough is under [Retargeting to your app](#retargeting-to-your-app).

---

## The twelve rules, and why they hold

The value is not a Playwright wrapper. It is a small set of conventions that keep a suite fast, readable and trustworthy as it grows, held in place by a machine so they do not decay into a wiki page nobody reads.

**Nine of the twelve are enforced by ESLint at `--max-warnings=0`, and the lint rules are themselves unit-tested**, so a rule that stops firing fails the build. The other three (one scenario per test, reviewing a trace, healer discipline) are not statically decidable. [docs/GOLDEN_RULES.md](docs/GOLDEN_RULES.md) says which is which, and why, rather than rounding nine up to twelve.

| Rule | Why it matters |
| ---- | -------------- |
| **Locators: `getByRole`, then `getByLabel`, then `getByTestId`, never CSS or XPath** | Tests bind to what a user perceives, not to brittle DOM structure. When the markup changes but the behaviour does not, the test still passes. |
| **All UI interaction lives in Page Objects (`pages/`)** | No `page.click()` in a spec. One place to update when a screen changes, and specs that read like intent. |
| **Auth, data and setup come from fixtures, never inline** | No logging in inside a test, no copy-pasted setup. State is injected, so tests stay independent and parallel-safe. |
| **Web-first assertions only, no `waitForTimeout` or sleeps** | `expect(locator).toBeVisible()` retries until true or times out. Arbitrary sleeps are the first cause of flake. |
| **Mock third parties at the network layer** | Payment, identity and analytics calls are stubbed via `page.route()`. No real external call in a test run. |
| **Synthetic data only (faker), never real PII** | Nothing sensitive reaches the repo, the snapshots or CI. |
| **One scenario per test, and clean up what you create** | Compound tests hide failures. A `cleanup` fixture disposes any record a test creates, so a shared account never accumulates junk. |

The full knowledge base (locators, fixtures, mocking, auth, accessibility, mutation testing, CI) is in [`skills/SKILL.md`](./skills/SKILL.md).

---

## What is in the box

Proven against the reference application, in CI:

- **BDD** via [`playwright-bdd`](https://github.com/vitalets/playwright-bdd): Gherkin in `features/` compiled to Playwright specs.
- **Page Objects, fixtures and synthetic data**, all reachable from one `test` object: `pages`, `data` (faker), an `api` request context, and `cleanup` disposers.
- **API contract checks** that validate responses against a schema (`utils/contract.ts`, zod).
- **Requirement traceability**: `@req:` tags mapped to a coverage matrix.
- **Unit and mutation testing** (Vitest and StrykerJS) over the framework's own logic.
- **CI** (GitHub Actions): lint, unit and mutation, and the BDD suite against the real app.
- **An AI-agent skills base** (`skills/`) so assistants generate tests that follow the rules.

Shipped, but honestly not yet exercised against the reference app, and not counted among the proven lanes: network fault injection and accessibility helpers are self-tested against stubs, and visual and performance helpers ship with documentation only. They are marked as scaffolding in [docs/GOLDEN_RULES.md](docs/GOLDEN_RULES.md). We would rather say that here than let you discover it.

Architecture overview: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Decisions in [`docs/decisions/`](./docs/decisions).

---

## What this is not

The fastest way to judge a framework is to read what it declines to claim.

- **Not a test generator.** Agent briefs are included and `AGENTS.md` gives assistants the rules, but nothing here writes your tests for you or heals them at runtime.
- **Not a coverage percentage.** "24 of 24" means 24 requirements written down here, not the whole application. A requirement never catalogued cannot show up as a gap, and the docs say so.
- **Not on npm, and not a CLI.** You use the template or fork it, and you own the result.
- **Not your domain.** The reference application is a project-and-task tool with real auth, a REST API and real authorization rules, but it is not your product, and no demo is.

---

## Where the tests live

Four lanes, deliberately separate. If you open `tests/` and wonder where the rest went, this is the map:

| Lane | Lives in | Runs against | Browser |
| ---- | -------- | ------------ | ------- |
| **API** | `tests/api/*.api.spec.ts` | the reference app's REST API | no |
| **App UI** | `features/*.feature`, generated into `.features-gen/` | the reference app | yes |
| **Portability** | the same `features/`, `@todos` scenarios | TodoMVC | yes |
| **Framework self-tests** | `framework-tests/` | nothing, fully offline | yes |

`tests/` holds tests of the application. `framework-tests/` holds tests of this framework's own helpers, and needs no app, no network and no auth.

**The UI tests are generated.** You edit Gherkin in `features/*.feature`, and `npm run bdd:gen` writes the runnable specs into `.features-gen/`. VS Code's Testing panel lists the generated files, so run that first or two thirds of the suite looks missing. Every `test:*` and `bdd:*` script does it for you.

```bash
npm run test:api      # API lane, no browser, a few seconds
npm run test:app      # the reference app, signed in and signed out
npm run bdd:test      # TodoMVC, no download needed
npm run test:examples # framework self-tests, fully offline
npm run test:ui       # Playwright UI mode: time travel, watch, pick locator
npm run test:headed   # watch a real browser drive it
```

---

## Working with AI agents

[AGENTS.md](AGENTS.md) is the single instruction file every AI coding agent reads: the lanes, the enforced rules, the constraints of the application under test, and what to run before opening a pull request. `.github/copilot-instructions.md` and the agent briefs in `.github/agents/` point at it rather than restating it.

That is not tidiness for its own sake. An earlier copy told agents to mock with `page.route()` and to import faker directly, and the lint rules now reject both. An instruction file that has drifted is worse than none, because it generates work that fails review.

---

## Using this as a template

This repository is a GitHub template. **Use this template, then Create a new repository** gives you the framework with no history, ready to point at your own application.

What to do first, in order:

1. `npm install && npm run setup && npm test`, to confirm it is green before you change anything, so a later failure is unambiguously yours.
2. Set `BASE_URL` to your application. The demo download is then skipped, and the app lane runs against you instead.
3. Replace `pages/` and `features/`. Those two directories are the only application-specific ones. `fixtures/`, `utils/` and `skills/` are the reusable core, and lint enforces that they stay that way.
4. Rewrite `requirements/*.md` for your own requirements, or delete them and let the matrix report zero until you do. An empty matrix is honest, a stale one is not.
5. Keep `framework-tests/`. They test the machinery you have just inherited, and they need no application at all.

---

## Retargeting to your app

The core is application-agnostic by design (see [ADR-003](./docs/decisions/ADR-003-app-agnostic-design.md)). To adopt it:

1. Set `BASE_URL` in `.env` to your app's origin.
2. Write Page Objects in `pages/` and register them in `fixtures/pages.fixture.ts`.
3. Write `.feature` files and step definitions in `features/`.
4. If your app needs a login, capture a `storageState` once and wire it into the bdd project in `playwright.config.ts`. See [`skills/core/auth.md`](./skills/core/auth.md).

`features/auth.feature` with `LoginPage` and `tests/auth.setup.ts` is the example to model an authenticated app on. `TodoPage` with `features/todos.feature` is the minimal one.

---

## Built by Certance Advisory

A quality-engineering framework by [Certance Advisory](https://www.certance.eu/). Contributions welcome, see [CONTRIBUTING.md](./CONTRIBUTING.md).

MIT licensed ([LICENSE](./LICENSE)). Third-party attributions in [NOTICE](./NOTICE).
