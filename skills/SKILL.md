---
name: certance-playwright-framework
version: 1.0.0
description: >
  Certance Lens — the enterprise Playwright UI automation framework.
  Built on Clean Code principles, SOLID design patterns, and software engineering best practices.
  Load this skill whenever writing, reviewing, fixing, or generating Playwright tests.
applies-when: >
  Any task involving Playwright test creation, maintenance, migration,
  CI/CD pipeline setup, or test architecture decisions.
do-not-use-when: >
  Unit tests, Jest/Vitest component tests, or non-browser automation tasks.
agents:
  - claude-code
  - github-copilot
  - cursor
  - windsurf
transport:
  default: playwright-cli
  exploratory: playwright-mcp
foundations:
  - clean-code-principles
  - solid-design-principles
  - enterprise-design-patterns
  - test-automation-patterns
---

# Certance Lens — UI Automation Framework · root skill

This is the entry point for all AI coding agents working within
**Certance Lens**, the enterprise Playwright UI automation framework.
Read this file first. Load sub-guides as needed based on the task at hand.

**Foundation**: This framework is built upon Robert C. Martin's Clean Code principles,
SOLID design principles, and proven software engineering patterns. Every line of code
must adhere to these foundations for maintainability, readability, and testability.

---

## Foundation principles

- **Clean Code** — meaningful names, single responsibility, self-documenting code (Uncle Bob)
- **SOLID** — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- **Patterns** — Page Object Model, Factory, Command — applied throughout. See `docs/CODING_STANDARDS.md`.

---

## 12 golden rules

These rules are non-negotiable. They apply to every line of test code
generated, reviewed, or modified in a Certance Lens project.

> **How each rule is enforced.** `npm run lint` runs with `--max-warnings=0`, so a warning
> fails the build the same as an error. Not every rule below is machine-checkable, so the
> table says exactly which are — a rule enforced only by review is still a rule, but calling
> it automated would be a lie an adopter can check in two minutes.
>
> | Rule                              | Enforced by                                                                       |
> | --------------------------------- | --------------------------------------------------------------------------------- |
> | 1 · Locator hierarchy             | **lint** — `.locator()`, `page.$`/`$$`, and text locators in specs are errors     |
> | 2 · Page Object Model             | **lint** — direct `page.click/fill/press/...` in a spec or step is an error       |
> | 3 · Fixtures over beforeEach      | review                                                                            |
> | 4 · Test independence             | review                                                                            |
> | 5 · Web-first assertions          | **lint** — `waitForTimeout`, missing `await`, and assertion-free tests are errors |
> | 6 · Mock external dependencies    | review                                                                            |
> | 7 · No real PII                   | review                                                                            |
> | 8 · One scenario per test         | review                                                                            |
> | 9 · Trace on for new tests        | **config** — `trace: 'retain-on-failure'` in `playwright.config.ts`               |
> | 10 · Healer owns locator fixes    | process                                                                           |
> | 11 · Fixtures inject Page Objects | review                                                                            |
> | 12 · Application-agnostic core    | **lint** — `utils/` importing `pages/` or `features/` is an error                 |
>
> The lint rules are themselves tested (`unit/golden-rules.unit.test.ts`): each one is run
> against code that should break it, so a rule that stops firing fails the build.
> `npm run lint:fix` autofixes what it can; `npm run format` runs Prettier.

1. **Locators** — always use `getByRole()`, `getByLabel()`, or
   `getByTestId()`. Never use CSS selectors, XPath, or class-based
   locators. If a stable locator does not exist, ask the developer to
   add `data-testid`.

2. **Page Object Model** — every page or reusable UI component gets a
   Page Object class in `pages/`. No raw `page.click()` or
   `page.fill()` calls inside `*.spec.ts` files.

3. **Fixtures over BeforeEach** — authentication state, test data
   seeding, and shared setup live in `fixtures/`. Never log in inside
   a test body. Never repeat setup logic across spec files.

4. **Test independence** — every test must run in isolation. No shared
   mutable state between tests. No test must depend on the execution
   order of another test.

5. **Assert after every action** — never navigate or interact without
   a follow-up assertion. Use Playwright's web-first assertions
   (`expect(locator).toBeVisible()`) — never `waitForTimeout()`.

6. **Mock external dependencies** — all third-party APIs (payment
   gateways, identity providers, analytics) must be mocked at the
   network layer using `page.route()`. Never call real external
   endpoints in automated tests. Use the **`network` fixture**
   (`fixtures/network.fixture.ts`): `mockThirdParties` blocks
   analytics/telemetry by default; `mock(url, handler)` fakes your
   own endpoints. See `core/mocking.md`.

7. **Data masking** — never commit real PII, credentials, or
   production data in test files, fixtures, or snapshots. Use the
   **`data` fixture** (`fixtures/data.fixture.ts`): `data.*` for
   unique persisted entities, `data.realistic.*` (faker) for display
   values, `data.edge.*` for boundary/stress + input-hardening probes.
   Mask screenshots in CI if they may contain sensitive fields.
   See `core/test-data.md`.

8. **One scenario per test** — each `test()` block covers exactly one
   user scenario. Compound tests that check multiple unrelated things
   must be split. Use `test.describe()` to group related scenarios.

9. **Trace on for new tests** — run `npx playwright test --trace=on`
   for every new test before committing. Review the trace. Fix any
   implicit waits or timing assumptions before pushing.

10. **Healer owns locator fixes** — when locators break due to UI
    changes, run the Healer agent. Do not manually patch selectors in
    bulk. If the Healer marks a test `test.fixme()`, treat it as a
    genuine application regression — investigate before overriding.

11. **Fixtures inject Page Objects** — never instantiate Page Objects
    with `new` inside a test body or step definition. Receive them
    via Playwright fixtures: `async ({ todosPage }) => { ... }`.
    Add any new Page Object to `fixtures/index.ts` before use.

12. **Application-agnostic core** — the `skills/`, `fixtures/`, `utils/`,
    CI pipelines, and framework docs never reference a specific application
    (no hard-coded application name in core files). Only `pages/`,
    `features/`, and `.env` are project-specific.

---

## Transport layer — MCP vs CLI

Choose the right transport for the task. This decision affects token
consumption and agent effectiveness.

### Use Playwright CLI (`@playwright/cli`) when

- Generating or migrating tests across a large codebase
- Running bulk test scaffolding from user stories or requirements
- Debugging CI failures in a coding agent terminal session
- Context window efficiency is a priority
- Working with Claude Code, GitHub Copilot, Cursor, or Windsurf

```bash
npm install -g @playwright/cli@latest
playwright-cli open https://demo.playwright.dev/todomvc --headed
playwright-cli snapshot
playwright-cli click e21
playwright-cli screenshot
```

Token cost: ~27,000 tokens per session. Outputs saved to disk —
agent reads only what it needs.

### Use Playwright MCP when

- Exploring a new application for the first time
- Running the Planner agent to map user flows
- Self-healing tests with iterative DOM inspection
- Conversational / interactive debugging sessions
- Persistent browser context across multiple reasoning steps

Token cost: ~114,000 tokens per session. Full accessibility tree
streamed inline — justified for exploratory and healing workflows.

---

## Agent pipeline — Planner → Generator → Healer

Initialise agents once per project:

```bash
npx playwright init-agents
```

Regenerate whenever Playwright is updated.

### Planner agent

**Input:** `seed.spec.ts` + live staging environment  
**Output:** `plans/*.md` — human-readable test plan  
**When to run:** At project start, or when new feature areas need coverage  
**Review step:** Show the markdown plan to the team or stakeholders before
running the Generator. Validate scope, prioritise flows, confirm edge cases.

### Generator agent

**Input:** `plans/*.md` + `SKILL.md` knowledge base  
**Output:** `tests/*.spec.ts` — runnable Playwright test files  
**When to run:** After the plan has been reviewed and approved  
**Key behaviour:** Verifies selectors live against the DOM as it writes.
Will not generate brittle selectors — it finds stable alternatives.

### Healer agent

**Input:** Failing test suite + accessibility tree snapshots + console logs  
**Output:** Patched locators or `test.fixme()` annotations  
**When to run:** After any UI change that breaks existing tests  
**Key behaviour:** Distinguishes broken locators (fixes them) from genuine
application regressions (marks `fixme`, does not mask the bug).

---

## Project structure

Every Certance Lens project uses this canonical folder structure.
Do not deviate without documenting the reason in `docs/decisions/`.

```
project-root/
├── .github/
│   ├── copilot-instructions.md   # Agent conventions for this repo
│   └── workflows/
│       └── playwright.yml        # CI pipeline (smoke + nightly regression)
├── .claude/
│   └── CLAUDE.md                 # Claude Code conventions for this repo
├── playwright.config.ts          # Single source of truth for config
├── .env.example                  # Committed env template — no secrets
├── pages/                        # Page Object classes
│   ├── BasePage.ts               # Shared helpers — UPDATE assertAppLoaded()
│   ├── [FeatureName]Page.ts      # One class per page / major view
│   ├── [FeatureName]Modal.ts     # One class per modal dialog
│   └── components/               # Reusable UI widget objects
├── fixtures/
│   └── index.ts                  # All Page Object fixtures — extend here
├── tests/
│   ├── seed.spec.ts              # Auth bootstrap — UPDATE post-login assertion
│   └── [feature].spec.ts         # Direct specs (infrastructure, API, perf)
├── features/
│   ├── [feature].feature         # Gherkin scenarios (business-readable)
│   └── step-definitions/
│       ├── common.steps.ts       # Shared steps (auth, navigation)
│       └── [feature].steps.ts   # Feature-specific steps
├── plans/                        # Planner agent output — review with the team
├── test-data/
│   ├── .auth/                    # Saved storageState — gitignored
│   └── README.md                 # Documents pre-seeded records
├── utils/
│   ├── env.ts                    # Type-safe env var access
│   └── test-data.ts              # Synthetic data factory
├── skills/                       # AI agent knowledge base
│   ├── SKILL.md                  # This file — root entry point
│   ├── core/                     # locators, auth, fixtures, mocking, test-data
│   ├── ci/                       # GitHub Actions, Azure DevOps, Docker
│   ├── pom/                      # Page Object patterns + component objects
│   ├── migration/                # From Selenium / Cypress
│   └── reporting/                # Allure reporting and tag taxonomy
└── docs/
    ├── ARCHITECTURE.md           # Full framework architecture reference
    ├── CODING_STANDARDS.md       # Clean Code / SOLID / patterns reference
    ├── DEVELOPER_GUIDE.md        # Day-to-day contributor guide
    └── decisions/                # Architecture decision records
        ├── ADR-TEMPLATE.md
        ├── ADR-001-playwright-bdd.md
        ├── ADR-002-page-object-model.md
        ├── ADR-003-app-agnostic-design.md
        ├── ADR-004-clean-code-solid-principles.md
        └── ADR-005-design-patterns-test-automation.md
```

---

## Guide index

Load the relevant guide for the task at hand. Do not load all guides
at once — load only what the current task requires.

### Core guides

| Guide                                            | Load when                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [Locator strategy](./core/locators.md)           | Writing any selector or finding elements                                                 |
| [Assertions](./core/assertions.md)               | Writing expect() statements                                                              |
| [Authentication patterns](./core/auth.md)        | Any test requiring login                                                                 |
| [Network mocking](./core/mocking.md)             | Intercepting API calls                                                                   |
| [Fixtures and hooks](./core/fixtures.md)         | Setting up shared test state                                                             |
| [Test data factory](./core/test-data.md)         | Generating or managing test data                                                         |
| [Debugging and tracing](./core/debugging.md)     | Diagnosing test failures — run `npm run compress:output` before pasting output into chat |
| [Parallel execution](./core/parallel.md)         | Sharding or worker configuration                                                         |
| [Visual regression](./core/visual.md)            | Screenshot comparison tests                                                              |
| [Accessibility testing](./core/accessibility.md) | WCAG / axe-core checks                                                                   |
| [API testing](./core/api.md)                     | Using Playwright request context                                                         |

### CI / CD guides

| Guide                                      | Load when                             |
| ------------------------------------------ | ------------------------------------- |
| [GitHub Actions](./ci/github-actions.md)   | Setting up GitHub CI pipeline         |
| [Azure DevOps](./ci/azure-devops.md)       | Setting up Azure pipeline             |
| [Docker](./ci/docker.md)                   | Containerising test execution         |
| [Sharding strategy](./ci/sharding.md)      | Splitting large suites across workers |
| [Environment config](./ci/environments.md) | Managing staging / UAT / prod-mirror  |

### Page Object Model guides

| Guide                                    | Load when                          |
| ---------------------------------------- | ---------------------------------- |
| [POM patterns](./pom/patterns.md)        | Creating or extending Page Objects |
| [Component objects](./pom/components.md) | Reusable UI component abstractions |

### Playwright CLI guides

| Guide                                                 | Load when                          |
| ----------------------------------------------------- | ---------------------------------- |
| [CLI reference](./playwright-cli/reference.md)        | Using playwright-cli commands      |
| [YAML flow recording](./playwright-cli/yaml-flows.md) | Recording interactions as YAML     |
| [Session management](./playwright-cli/sessions.md)    | Managing multiple browser sessions |

### Migration guides

| Guide                                         | Load when                      |
| --------------------------------------------- | ------------------------------ |
| [From Selenium](./migration/from-selenium.md) | Migrating Selenium test suites |
| [From Cypress](./migration/from-cypress.md)   | Migrating Cypress test suites  |

### Reporting guides

| Guide                                     | Load when                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| [Allure reporting](./reporting/allure.md) | Setting up or interpreting Allure reports, tag taxonomy, CI publishing |

### Agent workflow & transport guides

| Guide                                                               | Load when                                                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Playwright agent workflows](./playwright-agent-workflows/SKILL.md) | Designing planner / generator / healer / reviewer / library-manager phase and role boundaries |
| [Transport routing](./playwright-transport-routing/SKILL.md)        | Choosing CLI vs MCP vs snapshots for a task; minimizing MCP tool surface                      |

---

## BDD layer — Gherkin + playwright-bdd

Every Certance Lens project uses a Gherkin layer on top of Playwright Test via
[`playwright-bdd`](https://vitalets.github.io/playwright-bdd/). Same runner,
same reporters, same fixtures — no separate Cucumber process.

### Gherkin rules

- Feature = one business capability; Scenario = exactly one user story
- Background replaces BeforeEach; Scenario Outline for data-driven variations
- Given/When/Then only — never raw `page.*` calls in step definitions
- Tag: `@smoke` (CI), `@regression` (nightly), `@wip` (excluded in CI)

### Workflow

```bash
npm run bdd:gen        # compile .feature → .spec.ts (run before every test run)
npm run bdd:test       # run BDD suite on Chromium
npm run bdd:smoke      # @smoke subset (runs in CI)
npm run bdd:regression # @regression subset
```

See `features/` for live examples and `features/step-definitions/` for step patterns.

---

## Auth seed — only when the app under test requires login

The runnable reference in this repo targets the public
[TodoMVC demo](https://demo.playwright.dev/todomvc) — no login, no
`storageState`, no secrets. For an application that **does** require
authentication, add a seed spec that logs in once, saves `storageState`, and
reuse it across the suite. It must pass reliably — a flaky seed breaks the
whole run. See `core/auth.md` for the pattern.

---

## `playwright.config.ts` — non-negotiable settings

See `playwright.config.ts`. Key decisions:

- `forbidOnly` — prevents `test.only()` reaching CI
- `retries: 2` in CI — catches flakiness without hiding failures
- `trace: 'on-first-retry'` — debug data without storing traces for passing tests
- Chromium only (Firefox + WebKit dropped by project decision) — re-enable cross-browser projects per project need

---

## Agent instruction files

Each AI agent reads a different conventions file. All must exist in every project repo.
See `.github/copilot-instructions.md`, `.claude/CLAUDE.md`, and `.cursorrules` for
the canonical templates. All must enforce the same golden rules in each agent's native format.

---

## Quick-start checklist — new project

Run through this on day one. Every item must be complete before
running the Planner agent.

- [ ] Clone or scaffold the project repo
- [ ] Set `BASE_URL` in `.env` (defaults to the public TodoMVC demo — no login,
      no secrets). Add `TEST_USER_*` only if the app under test requires auth.
- [ ] Run `npm install` and `npx playwright install --with-deps`
- [ ] Run `npx playwright init-agents` to generate agent definitions
- [ ] Create `.github/copilot-instructions.md`
- [ ] Create `.claude/CLAUDE.md`
- [ ] Create `.cursorrules`
- [ ] If the app requires auth: write and verify an auth seed spec — must pass cleanly
- [ ] Run Planner agent against the target environment
- [ ] Review generated `plans/*.md` with the team
- [ ] Run Generator agent on approved plans
- [ ] Run `npx playwright test` — confirm generated tests pass
- [ ] Connect CI pipeline using `ci/github-actions.md` or `ci/azure-devops.md`
- [ ] Confirm HTML report publishes correctly in CI

---

## Versioning

Semantic versioning. Pin the skill version in each project repo.
Upgrades are a deliberate activity — not an automatic dependency update.

**Certance Lens** — UI Automation Framework · Framework v1.0.0 · Playwright ^1.62.1 · Last reviewed: July 2026

<!-- Compatibility floor is ≥1.56: Playwright Agents / `npx playwright init-agents` require it. Pinned in package.json at ^1.62.1. -->
