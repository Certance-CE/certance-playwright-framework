# Certance Lens — Architecture Reference

> Version 1.0 · Last updated 2026-03-29  
> Maintained by Certance Advisory · applies to every client engagement

---

## 1. Purpose and philosophy

This framework is designed to be **application-agnostic** and built upon **software engineering best practices**. It ships to any corporate client whose front-end team needs world-class browser test automation. The same folder structure, the same agent pipeline, the same skill guides — only the `pages/`, `features/`, and `.env` file change between clients.

**Foundation**: Every line of code adheres to Robert C. Martin's Clean Code principles, SOLID design principles, and proven software engineering patterns. This ensures maintainability, readability, and testability at enterprise scale.

Core design values:

| Value               | How it is enforced                                                                       | Foundation Principle                                     |
| ------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Stability**       | Locator hierarchy: `getByRole` → `getByLabel` → `getByTestId`. CSS and XPath are banned. | **Strategy Pattern** — consistent locator strategies     |
| **Readability**     | BDD Gherkin layer so business stakeholders can read and sign off specs                   | **Clean Code** — intention-revealing names               |
| **Isolation**       | Every test is fully independent; auth state is injected, never built inside a test       | **Single Responsibility** — one scenario per test        |
| **Speed**           | Parallel execution by default; seed auth once per suite; CI sharding built-in            | **Dependency Inversion** — injected fixtures             |
| **Maintainability** | Page Objects own all selectors; Healer agent fixes broken locators automatically         | **Open/Closed Principle** — extend without modification  |
| **Portability**     | Zero hard-coded URLs or app-specific config outside `.env` and `playwright.config.ts`    | **Interface Segregation** — client-specific abstractions |

---

## 2. High-level architecture diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Certance Framework v1                        │
├───────────────┬─────────────────────────┬───────────────────────────┤
│  SKILL LAYER  │    AGENT PIPELINE        │   CI / CD LAYER           │
│               │                         │                           │
│  skills/      │  Planner ──► Generator  │  .github/workflows/       │
│  ├─ SKILL.md  │       └──► Healer       │  ├─ playwright.yml (PR)   │
│  ├─ core/     │                         │  └─ nightly.yml           │
│  ├─ pom/      │  Input: seed.spec.ts    │                           │
│  ├─ ci/       │  + staging environment  │  Docker image             │
│  └─ [client]/ │                         │  playwright:focal-latest  │
├───────────────┴─────────────────────────┴───────────────────────────┤
│                         TEST LAYER                                  │
│                                                                     │
│  features/                    tests/                                │
│  ├─ *.feature  (Gherkin)      └─ seed.spec.ts  (auth bootstrap)    │
│  └─ step-definitions/             *.spec.ts    (direct specs)       │
│      ├─ common.steps.ts                                             │
│      └─ [feature].steps.ts                                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      PAGE OBJECT LAYER                       │  │
│  │  pages/                                                       │  │
│  │  ├─ BasePage.ts          shared navigation + wait helpers     │  │
│  │  ├─ [Feature]Page.ts     one class per full page              │  │
│  │  ├─ [Feature]Modal.ts    dialog / overlay components          │  │
│  │  └─ components/ *        reusable sub-page widgets            │  │
│  │                 * created when component count warrants it    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                       FIXTURE LAYER                          │  │
│  │  fixtures/                                                    │  │
│  │  ├─ index.ts             composes all fixtures; sole import   │  │
│  │  ├─ pages.fixture.ts  ✓  typed Page Object instances         │  │
│  │  ├─ data.fixture.ts   *  test data factory (add when needed)  │  │
│  │  └─ api.fixture.ts    *  API client injection (add when needed)│  │
│  │                 * scaffold from pages.fixture.ts as template  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  utils/          env.ts · test-data.ts · [helpers/ when grows]     │
│  test-data/      .auth/ (storageState) · README (seed data docs)   │
│  docs/plans/     Planner output — human-readable scenario specs     │
├─────────────────────────────────────────────────────────────────────┤
│                     CONFIGURATION LAYER                             │
│                                                                     │
│  playwright.config.ts  — single source of truth for all settings   │
│  .env                  — secrets and per-environment overrides      │
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

- `skills/core/` — locators, assertions, auth, mocking, fixtures, test data, debugging
- `skills/pom/` — Page Object patterns and component objects
- `skills/ci/` — GitHub Actions, Azure DevOps, Docker, sharding
- `skills/migration/` — from Selenium, from Cypress
- `skills/[client-name]/` — per-client context, custom rules, known app quirks

### 3.2 Agent pipeline

Three specialised AI agents form an assembly line. Each has a distinct input
and output contract. Never run them out of order.

```
Planner   →  docs/plans/*.md    Human-readable scenarios; reviewed by client
Generator →  tests/*.spec.ts    Working Playwright specs against live DOM
Healer    →  patched locators   Fixes breakage after UI changes
```

> **Note**: Planner output (`.md` scenario plans) lives in `docs/plans/` — not at
> the project root — because plans are documentation artefacts, not source code.
> The root `plans/` directory is a migration alias; new plans go to `docs/plans/`.

See `docs/ONBOARDING.md` for step-by-step invocation.

### 3.3 BDD layer (`features/`)

Gherkin `.feature` files are the **contract** between QA and the business.
They are compiled to runnable `.spec.ts` files by `playwright-bdd` at
pre-test time (`npm run bdd:gen`). Never edit generated files.

Tag discipline:

- `@smoke` — must pass on every PR (< 5 min wall clock on CI)
- `@regression` — runs on nightly schedule
- `@wip` — excluded from CI; work in progress

### 3.4 Page Object layer (`pages/`)

Every page or significant UI component gets exactly one class. Classes extend
`BasePage`. Methods are **action-level** (not locator-level): `fillTitle()`,
not `getTitle elementLocator()`. Assertions in Page Objects are allowed only
for state verification that is local to that component.

Locator priority (enforced by lint and code review):

1. `getByRole()` — ARIA semantics first
2. `getByLabel()` — form fields by label
3. `getByTestId()` — stable `data-testid` attribute (request from dev team)
4. `getByPlaceholder()` — acceptable for inputs with no label
5. **Banned:** CSS selectors, XPath, class-based selectors, nth-child

### 3.5 Fixture layer (`fixtures/`)

Fixtures manage all cross-cutting concerns: authentication, page instances,
test data. Every spec that needs a Page Object receives it through a fixture,
not by instantiating it manually with `new`.

```typescript
// Correct — Page Object from fixture
test('adds a todo', async ({ todoPage }) => {
  await todoPage.addTodo('Buy milk');
});

// Wrong — manual instantiation
test('adds a todo', async ({ page }) => {
  const todos = new TodoPage(page); // ❌ don't do this
});
```

### 3.6 Configuration layer

`playwright.config.ts` is the only place that defines environments, projects,
timeouts, and reporters. Secrets live in `.env` (never committed).
`.env.example` is always committed and kept up to date.

---

## 4. Portability contract — what changes between clients

When deploying this framework to a new client project, only these artefacts
need to change:

| Artefact                     | Changes?               | Notes                                          |
| ---------------------------- | ---------------------- | ---------------------------------------------- |
| `playwright.config.ts`       | env vars only          | `BASE_URL`, `storageState` path                |
| `.env`                       | yes, per client        | credentials, URLs — never committed            |
| `.env.example`               | yes, document new vars | committed template                             |
| `pages/`                     | yes                    | new Page Objects for client's app              |
| `features/`                  | yes                    | new Gherkin scenarios                          |
| `docs/plans/`                | yes                    | new Planner output                             |
| `skills/[client-name]/`      | yes                    | client-specific agent context                  |
| `tests/seed.spec.ts`         | yes                    | client-specific post-login assertion           |
| `fixtures/`, `utils/`        | usually not            | generic helpers reuse across clients           |
| `skills/core/`, `skills/ci/` | never                  | shared knowledge base, never edited per-client |

---

## 5. Dependency inventory

| Package            | Purpose                          | Version policy       |
| ------------------ | -------------------------------- | -------------------- |
| `@playwright/test` | test runner + browser automation | always latest stable |
| `playwright-bdd`   | Gherkin → Playwright adapter     | always latest stable |
| `dotenv`           | `.env` loading                   | ^17                  |
| `@faker-js/faker`  | synthetic test data              | ^9                   |
| `typescript`       | type safety                      | ^6                   |
| `@types/node`      | Node typings                     | match Node LTS       |

Browsers are installed via `npx playwright install --with-deps` in CI.

---

## 6. Execution modes

| Command                | What it runs               | When to use                       |
| ---------------------- | -------------------------- | --------------------------------- |
| `npm run test:seed`    | auth bootstrap only        | first setup or if auth expires    |
| `npm run bdd:gen`      | compile Gherkin → spec     | after editing any `.feature` file |
| `npm run bdd:test`     | gen + run BDD (chromium)   | daily developer loop              |
| `npm run bdd:test:all` | gen + run BDD (3 browsers) | before merging                    |
| `npm run test`         | all non-BDD specs          | direct spec execution             |
| `npm run test:ui`      | Playwright UI mode         | interactive debugging             |
| `npm run test:debug`   | inspector mode             | step-by-step debugging            |
| `npm run test:report`  | open HTML report           | review last run results           |

---

## 7. Auth strategy

Authentication is handled once per suite run via `seed.spec.ts`. The saved
`storageState` (cookies + localStorage) is reused by every subsequent test.
This eliminates repeated login round-trips — the most common cause of slow
and flaky test suites.

```
npm run test:seed         # runs once; writes test-data/.auth/user.json
npm run bdd:test          # every test reads that file; no login UI hit
```

For multi-role scenarios (admin, viewer, editor), maintain separate seed
scripts and `storageState` files:

```
test-data/
└── .auth/
    ├── user.json       default authenticated user
    ├── admin.json      admin role
    └── viewer.json     read-only role
```

---

## 8. Test data philosophy

- All test data is **synthetic** — generated by `@faker-js/faker`, never real PII
- Tests that create data must also clean it up (or use isolated namespaces)
- Static payloads (API stubs, JSON files) live in `test-data/`
- Environment-specific seed data (pre-existing records used as read-only fixtures)
  are documented in `test-data/README.md`

---

## 9. CI strategy

Two pipelines:

1. **PR pipeline** (`playwright.yml`) — runs `@smoke` tagged tests only.
   Target: < 5 minutes. Blocks merge on failure.
2. **Nightly pipeline** (`nightly.yml`) — runs full suite with sharding across
   4 workers. Publishes HTML report as CI artefact.

All pipelines use the official `mcr.microsoft.com/playwright` Docker image to
guarantee browser version consistency.

---

## 10. Known framework limitations and roadmap

> The full prioritised backlog lives in [`docs/ROADMAP.md`](ROADMAP.md). This section
> records only the architectural limitations and how they were (or will be) resolved.

### Resolved

| Former limitation                       | Resolved by                                                                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No API test layer (request-only specs)  | `fixtures/api.fixture.ts` — an authenticated `APIRequestContext` (`api`) + `skills/core/api.md`. _Implemented as a fixture rather than the originally-planned `utils/api-client.ts`, so it composes with the other fixtures._          |
| No visual regression baseline           | Playwright's built-in `toHaveScreenshot` + `utils/visual.ts` (`stabilize`) + defaults in `playwright.config.ts` + `skills/core/visual.md`. _Chosen over `@percy/playwright`/`pixelmatch` — no external service, no extra dependency._  |
| No accessibility checks                 | `fixtures/a11y.fixture.ts` — `checkA11y()` via `@axe-core/playwright`, violations surfaced under an Allure "Accessibility" epic + `skills/core/accessibility.md`                                                                       |
| Healer agent requires manual invocation | `.github/workflows/auto-heal.yml` (Claude) and `auto-heal-copilot.yml` (Copilot) — closed-loop, opt-in via the `AGENT_RUNTIME` variable                                                                                                |
| No test-data cleanup strategy           | `fixtures/cleanup.fixture.ts` — a `cleanup` registry whose disposers run LIFO, **even when the test fails**, with per-disposer error isolation. Transport-agnostic (API _or_ Page Object). Contract proven by `tests/cleanup.spec.ts`. |

### Open

None at the architectural level.

> **Adoption note.** The cleanup _mechanism_ ships and is proven by
> `tests/cleanup.spec.ts`. The TodoMVC reference example creates no server-side
> data, so it registers no disposers — wire them in for your own app when a test
> persists records that should not accumulate on a shared account.
