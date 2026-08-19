# Certance Lens — Architecture Reference

> Maintained by Certance Advisory

---

## 1. Purpose and philosophy

Certance Lens is an **application-agnostic** Playwright + BDD framework built on
established software-engineering practice. It runs out of the box against the
public TodoMVC demo (`https://demo.playwright.dev`); to test your own app you
point `BASE_URL` at it and add the Page Objects and features it needs. The folder
structure, the fixture composition, and the skill guides stay the same.

**Foundation**: the codebase follows Clean Code and SOLID principles and proven
design patterns (see [ADR-004](./decisions/ADR-004-clean-code-solid-principles.md)
and [ADR-005](./decisions/ADR-005-design-patterns-test-automation.md)). This keeps
it maintainable, readable, and testable as the suite grows.

Core design values:

| Value               | How it is enforced                                                                       | Foundation Principle                                    |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Stability**       | Locator hierarchy: `getByRole` → `getByLabel` → `getByTestId`. CSS and XPath are banned. | **Strategy Pattern** — consistent locator strategies    |
| **Readability**     | BDD Gherkin layer so stakeholders can read and sign off specs                            | **Clean Code** — intention-revealing names              |
| **Isolation**       | Every test is fully independent; any auth state is injected, never built inside a test   | **Single Responsibility** — one scenario per test       |
| **Speed**           | Parallel execution by default; CI sharding via the `blob` reporter                       | **Dependency Inversion** — injected fixtures            |
| **Maintainability** | Page Objects own all selectors; actions, not raw locators, are exposed to specs          | **Open/Closed Principle** — extend without modification |
| **Portability**     | No hard-coded URLs or app-specific config outside `playwright.config.ts` and `.env`      | **Interface Segregation** — app-specific abstractions   |

---

## 2. High-level architecture diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Certance Lens                            │
├───────────────┬─────────────────────────┬───────────────────────────┤
│  SKILL LAYER  │    AGENT PIPELINE        │   CI / CD LAYER           │
│               │                         │                           │
│  skills/      │  Planner ─► Generator    │  .github/workflows/       │
│  ├─ SKILL.md  │       ─► Reviewer        │  ├─ playwright.yml        │
│  ├─ core/     │       ─► Healer          │  │   • Lint + typecheck   │
│  ├─ pom/      │                         │  │   • Unit + mutation    │
│  ├─ ci/       │  (Claude Code +         │  │   • BDD (TodoMVC demo) │
│  ├─ reporting/│   Copilot; see skills/) │  └─ security.yml          │
│  └─ migration/│                         │      • CodeQL + dep-review │
├───────────────┴─────────────────────────┴───────────────────────────┤
│                         TEST LAYER                                  │
│                                                                     │
│  features/                    tests/                                │
│  ├─ todos.feature (Gherkin)   ├─ foundation.spec.ts                 │
│  └─ step-definitions/         ├─ cleanup.spec.ts                    │
│      └─ todos.steps.ts        ├─ contract.spec.ts                   │
│                               └─ network.spec.ts                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      PAGE OBJECT LAYER                       │  │
│  │  pages/                                                       │  │
│  │  ├─ BasePage.ts   shared navigation + wait helpers            │  │
│  │  └─ TodoPage.ts   the reference example (navigates /todomvc/) │  │
│  │        add one class per page/component for your own app      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                       FIXTURE LAYER                          │  │
│  │  fixtures/                                                    │  │
│  │  ├─ index.ts    composes all fixtures; the sole import point  │  │
│  │  └─ pages · allure · data · network · a11y · api · cleanup ·  │  │
│  │     perf   (each .extend()s the previous)                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  utils/    contract · performance · test-data · visual             │
│  test-data/  static payloads · (optional) .auth/ storageState      │
├─────────────────────────────────────────────────────────────────────┤
│                     CONFIGURATION LAYER                             │
│                                                                     │
│  playwright.config.ts  — single source of truth for all settings   │
│  .env                  — optional per-environment overrides (local) │
│  .env.example          — committed template; no secrets             │
│  tsconfig.json         — strict TypeScript                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Layer responsibilities

### 3.1 Skill layer (`skills/`)

The living knowledge base consumed by AI coding agents (GitHub Copilot, Claude,
Cursor, Windsurf). Agents read `SKILL.md` first, then load only the sub-guide
relevant to the current task. This keeps token cost low and agent output
accurate.

Sub-guides are organised under:

- `skills/core/` — locators, assertions, auth, mocking, fixtures, test data, accessibility, visual, performance, debugging, mutation, parallel, api
- `skills/pom/` — Page Object patterns and component objects
- `skills/ci/` — GitHub Actions, Azure DevOps, Docker, sharding, environments
- `skills/reporting/` — Allure taxonomy
- `skills/migration/` — from Selenium, from Cypress
- `skills/playwright-agent-workflows/`, `skills/playwright-cli/`, `skills/playwright-transport-routing/` — agent-pipeline conventions and transports

### 3.2 Agent pipeline

The framework documents a four-stage AI assembly line, with the conventions and
transports (bulk generation via `playwright-cli`, MCP for exploration and healing)
captured in the `skills/playwright-agent-workflows/` and
`skills/playwright-transport-routing/` guides:

```
Planner    →  human-readable scenarios
Generator  →  Playwright specs / step definitions against live DOM
Reviewer   →  review pass over generated code
Healer     →  patches locators after UI changes
```

Claude Code owns generation and self-healing; Copilot owns planning and review.

### 3.3 BDD layer (`features/`)

Gherkin `.feature` files are the **contract** between QA and the business. They
are compiled to runnable specs by `playwright-bdd` at pre-test time
(`npm run bdd:gen`, which writes to `.features-gen/`). Never edit generated files.

Tag discipline:

- `@smoke` — the fast subset (`npm run bdd:smoke`)
- `@regression` — everything except work-in-progress (`npm run bdd:regression`)
- `@wip` — excluded from the regression run; work in progress

### 3.4 Page Object layer (`pages/`)

Every page or significant UI component gets exactly one class, extending
`BasePage`. The reference example ships **two** classes — `BasePage` and
`TodoPage` (which navigates to its own path, `/todomvc/`). Add one class per
page/component for your own app. Methods are **action-level** (`addTodo()`), not
locator-level. Assertions in Page Objects are allowed only for state verification
local to that component.

Locator priority (enforced by lint and code review):

1. `getByRole()` — ARIA semantics first
2. `getByLabel()` — form fields by label
3. `getByTestId()` — stable `data-testid` attribute
4. `getByPlaceholder()` — acceptable for inputs with no label
5. **Banned:** CSS selectors, XPath, class-based selectors, nth-child

### 3.5 Fixture layer (`fixtures/`)

Fixtures manage all cross-cutting concerns. `fixtures/index.ts` composes every
module into one `test` object — the sole import point for specs and step
definitions. The composition chain (each module `.extend()`s the previous) is:

```
pages → allure → data → network → a11y → api → cleanup → perf
```

That single `test` object reaches Page Objects, synthetic data, network mocking,
accessibility checks, an API request context, cleanup disposers, and performance
metrics. Every spec that needs a Page Object receives it through a fixture, not by
instantiating it manually.

```typescript
// Correct — Page Object from fixture
test('adds a todo', async ({ todoPage }) => {
  await todoPage.addTodo('Buy milk');
});

// Wrong — manual instantiation
test('adds a todo', async ({ page }) => {
  const todos = new TodoPage(page); // don't do this
});
```

### 3.6 Configuration layer

`playwright.config.ts` is the only place that defines the base URL, projects,
timeouts, and reporters. Two projects are defined: `bdd:chromium` (the generated
Gherkin specs) and `chromium` (direct spec files under `tests/`). Environment
overrides live in an optional local `.env`; `.env.example` is committed and kept
up to date. The public reference example carries no secrets.

---

## 4. Adapting the framework to your own app

The reference example targets the TodoMVC demo. To point Lens at your own
application, change only these artefacts:

| Artefact                     | Changes?    | Notes                                                   |
| ---------------------------- | ----------- | ------------------------------------------------------- |
| `BASE_URL` (env / `.env`)    | yes         | your app origin; defaults to the TodoMVC demo           |
| `.env` / `.env.example`      | yes         | any per-environment overrides; document new vars        |
| `pages/`                     | yes         | new Page Objects for your app                           |
| `features/`                  | yes         | new Gherkin scenarios + step definitions                |
| `playwright.config.ts`       | optional    | wire `storageState` if your app needs login (see below) |
| `fixtures/`, `utils/`        | usually not | generic helpers reused as-is                            |
| `skills/core/`, `skills/ci/` | never       | shared knowledge base, never edited per-app             |

---

## 5. Dependency inventory

| Package                 | Purpose                          | Version |
| ----------------------- | -------------------------------- | ------- |
| `@playwright/test`      | test runner + browser automation | ^1.62.1 |
| `playwright-bdd`        | Gherkin → Playwright adapter     | ^9.2.0  |
| `@faker-js/faker`       | synthetic test data              | ^10.5.0 |
| `zod`                   | schema / contract validation     | ^4.4.3  |
| `allure-playwright`     | Allure reporter                  | ^3.10.2 |
| `@axe-core/playwright`  | accessibility checks             | ^4.13.0 |
| `web-vitals`            | performance metrics              | ^6.1.1  |
| `vitest`                | unit tests over framework logic  | ^4.1.10 |
| `@stryker-mutator/core` | mutation testing                 | ^10.0.0 |
| `typescript`            | type safety                      | ^6.0.3  |
| `dotenv`                | `.env` loading                   | ^17.4.2 |
| `@types/node`           | Node typings                     | ^26.2.0 |

Browsers are installed via `npx playwright install --with-deps chromium` in CI.

---

## 6. Execution modes

| Command                      | What it runs                           | When to use                       |
| ---------------------------- | -------------------------------------- | --------------------------------- |
| `npm run bdd:gen`            | compile Gherkin → specs                | after editing any `.feature` file |
| `npm run bdd:test`           | gen + run BDD (`bdd:chromium`)         | daily developer loop              |
| `npm run bdd:smoke`          | gen + run BDD, `@smoke` only           | fast confidence check             |
| `npm run bdd:regression`     | gen + run BDD, everything but `@wip`   | broad run before merging          |
| `npm run test`               | gen + run all Playwright projects      | full local run                    |
| `npm run test:examples`      | the four framework self-test specs     | exercise the reference examples   |
| `npm run test:unit`          | Vitest unit tests over framework logic | verify helpers/fixtures           |
| `npm run test:mutation`      | Stryker mutation testing               | check unit-test strength          |
| `npm run test:ui`            | Playwright UI mode                     | interactive debugging             |
| `npm run test:debug`         | inspector mode                         | step-by-step debugging            |
| `npm run test:report`        | open HTML report                       | review last run results           |
| `npm run lint` · `typecheck` | ESLint · `tsc --noEmit`                | the CI lint gate, locally         |

---

## 7. Authentication

The TodoMVC reference example needs no login, so none is wired by default — a
fresh clone runs green with no credentials. For an app that requires auth,
capture storage state once and set `storageState: 'test-data/.auth/user.json'` on
the `bdd:chromium` project in `playwright.config.ts`; every scenario then starts
authenticated and skips the login UI. Full guidance, including CI-safe injection,
is in `skills/core/auth.md`.

Auth state is injected, never built inside a test, and no storageState file is
committed to the repo.

---

## 8. Test data philosophy

- All test data is **synthetic** — the `data` fixture (backed by `@faker-js/faker`),
  never real PII.
- Tests that create server-side data must also clean it up — the `cleanup`
  fixture registers disposers that run LIFO, even when the test fails.
- Static payloads (API stubs, JSON files) live in `test-data/`.
- Third-party calls are stubbed via the `network` fixture, not hit for real.

---

## 9. CI strategy

Two GitHub Actions workflows, both running on `ubuntu-latest` with **no secrets**:

1. **`playwright.yml`** (on push / PR to `main`) — three parallel jobs:
   - **Lint + typecheck** — `npm run lint` and `npm run typecheck` (no browser).
   - **Unit + mutation** — `npm run test:unit` and `npm run test:mutation` over the
     framework's own logic; uploads the mutation report as an artefact.
   - **BDD (TodoMVC demo)** — installs Chromium, generates specs, runs the
     `bdd:chromium` project against the public demo; uploads the Playwright report.
2. **`security.yml`** (on push / PR + weekly schedule) — CodeQL analysis and
   dependency review.

Browser version consistency comes from `npx playwright install --with-deps`; there
is no dedicated Docker image, no scheduled nightly suite, and no auto-heal
workflow.

---

## 10. Reporting

Allure is the primary reporter (configured in `playwright.config.ts`), alongside
the built-in HTML/`list`/JSON reporters and a CTRF summary that feeds the GitHub
Actions run summary. Tag taxonomy (`@epic` / `@feature` / `@severity`) is defined
in `skills/reporting/allure.md`. Sharded runs use the `blob` reporter so shard
outputs can be recombined with `npx playwright merge-reports`.

---

## 11. Verified capabilities

The following are wired and proven in the reference example, not aspirational:

| Capability           | Implementation                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| API request context  | `fixtures/api.fixture.ts` (the `api` fixture) + `skills/core/api.md`                                           |
| Visual regression    | Playwright `toHaveScreenshot` defaults in `playwright.config.ts` + `utils/visual.ts` + `skills/core/visual.md` |
| Accessibility checks | `fixtures/a11y.fixture.ts` via `@axe-core/playwright`, surfaced under an Allure "Accessibility" epic           |
| Test-data cleanup    | `fixtures/cleanup.fixture.ts` — LIFO disposers that run even on failure, proven by `tests/cleanup.spec.ts`     |
| Contract validation  | `utils/contract.ts` (Zod) + `tests/contract.spec.ts`                                                           |
| Performance metrics  | `fixtures/perf.fixture.ts` + `utils/performance.ts` (`web-vitals`)                                             |

> **Adoption note.** The cleanup _mechanism_ ships and is proven by
> `tests/cleanup.spec.ts`. The TodoMVC reference example creates no server-side
> data, so it registers no disposers — wire them in for your own app when a test
> persists records that should not accumulate.
