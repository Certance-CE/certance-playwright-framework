---
mode: agent
description: >
  Master prompt — generates the complete framework documentation from scratch.
  Reads every source file first, then produces the full docs/ tree: navigation
  hub, architecture (overview, components, agents, interactions, tools), framework
  structure (Page Objects, fixtures, BDD, test data), knowledge base (skills
  architecture and full skill index), CI/CD, ADRs, runbooks, and contributing
  guide. Invoke this once to produce enterprise-grade documentation for the
  entire Certance Playwright framework.
---

# Generate Full Framework Documentation

You are the Certance technical writer. Your task is to generate complete,
Microsoft-grade documentation for this entire framework — from the navigation
hub down to every runbook and ADR.

Work through this prompt from top to bottom without skipping any step.
Do not start writing until the full reading phase is complete.

---

## PHASE 1 — Read everything first (do not write a single doc until this phase is done)

Read each of the following files. After reading, hold the information in
context — you will reference it throughout Phase 2. Never invent content
that contradicts what these files contain.

### 1.1 — Framework configuration

- `package.json` — versions, scripts, dependencies
- `playwright.config.ts` — projects, reporters, timeouts, browser config, BDD setup
- `tsconfig.json` — TypeScript configuration
- `template-config.json` — demo app name, Page Objects, features, step definitions to strip on client packaging
- `.mcp.json` — MCP server configuration
- `.env.example` — required environment variables

### 1.2 — Agent profiles (read all six)

- `.github/agents/playwright-test-planner.agent.md`
- `.github/agents/playwright-test-generator.agent.md`
- `.github/agents/playwright-test-healer.agent.md`
- `.github/agents/playwright-remote-healer.agent.md`
- `.github/agents/framework-template-builder.agent.md`
- `.github/agents/technical-writer.agent.md`

For each agent, extract: name, description, tools list, model, MCP servers,
and the core behaviour described in the body.

### 1.3 — Skills knowledge base (read all skill files)

- `skills/SKILL.md` — root skill, entry point, foundations
- `skills/core/auth.md`
- `skills/core/locators.md`
- `skills/core/assertions.md`
- `skills/core/fixtures.md`
- `skills/core/mocking.md`
- `skills/core/test-data.md`
- `skills/core/parallel.md`
- `skills/core/debugging.md`
- `skills/core/api.md`
- `skills/core/accessibility.md`
- `skills/core/visual.md`
- `skills/ci/github-actions.md`
- `skills/ci/environments.md`
- `skills/ci/sharding.md`
- `skills/ci/docker.md`
- `skills/ci/azure-devops.md`
- `skills/pom/patterns.md`
- `skills/pom/components.md`
- `skills/reporting/allure.md`
- `skills/migration/from-selenium.md`
- `skills/migration/from-cypress.md`
- `skills/playwright-cli/reference.md`
- `skills/playwright-cli/yaml-flows.md`
- `skills/playwright-cli/sessions.md`

For each skill, extract: applies-when, key rules, and the most important
patterns an engineer must not get wrong.

### 1.4 — Source code (read all implementation files)

- `pages/BasePage.ts`
- `pages/LoginPage.ts`
- `pages/TaskListPage.ts`
- `pages/TaskCreateModal.ts`
- `pages/TaskDetailPage.ts`
- `pages/SearchModal.ts`
- `fixtures/index.ts`
- `fixtures/pages.fixture.ts`
- `utils/env.ts`
- `utils/test-data.ts`
- `utils/obfuscation.ts`

### 1.5 — BDD layer

- `features/authentication.feature`
- `features/task-creation.feature`
- `features/task-management.feature`
- `features/search.feature`
- `features/list-views.feature`
- List all files in `features/step-definitions/`

### 1.6 — CI pipeline and GitHub configuration

- `.github/workflows/playwright.yml`
- `.github/workflows/copilot-setup-steps.yml`
- `.github/copilot-instructions.md`

### 1.7 — Existing documentation (read and absorb — do not duplicate, improve)

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/ONBOARDING.md`
- `docs/CODING_STANDARDS.md`
- `docs/CI_SETUP.md`
- `docs/decisions/ADR-001-playwright-bdd.md`
- `docs/decisions/ADR-002-page-object-model.md`
- `docs/decisions/ADR-003-app-agnostic-design.md`
- `docs/decisions/ADR-004-clean-code-solid-principles.md`
- `docs/decisions/ADR-005-design-patterns-test-automation.md`
- `docs/decisions/ADR-TEMPLATE.md`

### 1.8 — Confirm reading is complete

Before moving to Phase 2, state:

> "Reading phase complete. Found: [N] agents, [N] skills, [N] Page Objects,
> [N] feature files, [N] existing ADRs. Proceeding to generate [N] documents."

---

## PHASE 2 — Generate documentation (work section by section in the order below)

Apply these rules to every document you produce:

**Structure:** arc42 sections as defined in your agent instructions.
**Frontmatter:** YAML with title, section, audience, status, last-updated — always first.
**Diagrams:** Every architecture or flow document must contain at least one diagram.
Use Mermaid (C4, sequence, flowchart) for formal diagrams. Use ASCII box diagrams
for directory trees, structural overviews, and pipeline sketches.
**No abbreviations in diagrams** — full names for every participant and node.
**Prose:** Maximum 3 sentences before a heading or visual break.
**Tables** over bullet lists for comparisons and structured data.
**Related section:** Every document ends with `## Related` linking to 2–3 relevant pages.
**Grounded:** Every claim must be traceable to a file you read in Phase 1.
Flag anything uncertain with `[VERIFY: confirm in <filename>]`.

---

### Section 1 — Navigation hub

**File:** `docs/README.md`
**Audience:** all
**Purpose:** Single entry point. A reader must never need to browse folders.

Generate:

- One-paragraph introduction stating what the framework is and what problem it solves
- A Mermaid `graph TD` diagram showing the full documentation tree as a visual site map,
  with every section node and its key pages as sub-nodes
- A complete section index table with columns: Document | Audience | Description — one
  row per document across all eight sections
- A status column in the table showing `✅ stable`, `🔄 draft`, or `🔴 missing`
  for each page based on what you have generated
- Close with: "Last updated: [date]. To regenerate, invoke the `generate-full-docs` prompt."

---

### Section 2 — Introduction (docs/01-introduction/)

#### 2.1 — `docs/01-introduction/goals-and-requirements.md`

**Audience:** leadership, qa-lead
**arc42 §1**

Generate:

- Business context: why this framework exists, what enterprise QA problem it solves
- Three audience-specific value statements: for engineering leadership (risk and ROI),
  for QA leads (coverage and maintainability), for engineers (speed and reliability)
- Quality goals table: Goal | Measurable criterion | Priority (Critical / High / Normal)
  — derive from the golden rules and CI configuration you read
- Constraints: technology constraints (Playwright, TypeScript), organisational constraints
  (no PII in tests, regulated environment compatibility), conventions (arc42, SKILL.md pattern)

#### 2.2 — `docs/01-introduction/quality-scenarios.md`

**Audience:** qa-lead
**arc42 §10**

Generate:

- Quality scenarios table: Scenario | Stimulus | Response | Measurable outcome
- Cover: test reliability (no flakes), locator resilience (survives UI refactor),
  onboarding speed (new engineer productive in 30 min), CI green rate,
  coverage visibility (business can read the Allure report)
- Include an ASCII matrix showing quality attributes vs framework components

---

### Section 3 — Architecture (docs/02-architecture/)

> Note: docs/02-architecture/ already contains five pages generated in a prior session.
> Read each existing file, then **regenerate it with improvements** based on the
> full reading phase above. Do not skip — prior pages may be missing content
> now visible from the complete source reading.

#### 3.1 — `docs/02-architecture/overview.md`

Regenerate with: full C4 Context diagram including all actors from Phase 1 reads,
business outcome framing, system boundary diagram in ASCII as a companion to the C4.

#### 3.2 — `docs/02-architecture/component-map.md`

Regenerate with: C4 Container + Component diagrams, ASCII directory tree of the
full repo structure, execution-time sequence diagram showing feature → bddgen →
step definitions → fixtures → Page Objects → Playwright.

#### 3.3 — `docs/02-architecture/agent-pipeline.md`

Regenerate with: complete pipeline flowchart, one sequence diagram per agent stage,
agent capability matrix table, CI integration showing heal-on-failure trigger.
Add an ASCII pipeline sketch as a quick-reference overview above the detailed diagrams.

#### 3.4 — `docs/02-architecture/agent-interactions.md`

Regenerate with: agent picker flowchart (full names, no abbreviations), one
interaction sequence per agent, mistakes-to-avoid table.
Verify all agent names match the actual `.agent.md` files read in Phase 1.

#### 3.5 — `docs/02-architecture/tools-and-integrations.md`

Regenerate with: full tool inventory table with versions from `package.json`,
config snippets from `playwright.config.ts`, CI job sequence flowchart,
required secrets table from `playwright.yml`, integration diagram.

---

### Section 4 — Framework structure (docs/03-framework-structure/)

#### 4.1 — `docs/03-framework-structure/project-layout.md`

**Audience:** engineer
**arc42 §5**

Generate:

- ASCII directory tree of the entire repo (derived from Phase 1 file lists),
  with a one-line purpose comment on every folder and key file
- Table: Directory | Contains | Read by | Written by
- Explain the separation: `pages/` is UI interaction, `fixtures/` is composition,
  `features/` is intent, `skills/` is agent knowledge, `.github/agents/` is AI tooling

#### 4.2 — `docs/03-framework-structure/page-objects.md`

**Audience:** engineer

Generate:

- POM pattern explanation with ASCII inheritance diagram:
  BasePage → LoginPage, TaskListPage, TaskCreateModal, TaskDetailPage, SearchModal
- Full Page Object index table: Class | File | Page/Component | Constructor | Key methods
  (derive every row from the source files you read in Phase 1 — no invented methods)
- Mermaid class diagram showing the inheritance hierarchy
- Naming and lifecycle rules (one class per page, no `new PageClass()` in specs)
- Usage pattern code block showing correct fixture injection

#### 4.3 — `docs/03-framework-structure/fixtures.md`

**Audience:** engineer

Generate:

- Fixture composition chain: ASCII diagram showing `playwright-bdd base` →
  `pages.fixture.ts` → `fixtures/index.ts` → test/step-definition
- All fixture names from `pages.fixture.ts` in a table: Fixture | Type | Page Object | Scope
- Correct usage pattern: import from `fixtures/index.ts`, never from `pages.fixture.ts` directly
- How to add a new fixture (step-by-step procedure)

#### 4.4 — `docs/03-framework-structure/bdd-workflow.md`

**Audience:** engineer

Generate:

- End-to-end flow: ASCII diagram: `.feature` → `bddgen` → `.features-gen/` → `playwright test`
- Tag reference table: Tag | Suite | CI job | Trigger
  (derive from `playwright.yml` and `playwright.config.ts`)
- BDD project configuration from `playwright.config.ts` (code block)
- How to write a new scenario: step-by-step with a worked example skeleton
- Mermaid sequence diagram: feature file → bddgen → generated spec → Playwright runner

#### 4.5 — `docs/03-framework-structure/test-data-strategy.md`

**Audience:** engineer

Generate:

- Three-tier data strategy: faker (synthetic), static files (`test-data/`), mocked APIs (`page.route()`)
- PII rules table: Data type | Allowed in tests | Allowed in fixtures | Allowed in skills
- Mocking boundary diagram: what is mocked vs what hits the real application
- Reference `utils/test-data.ts` and `skills/core/test-data.md` and `skills/core/mocking.md`

---

### Section 5 — Knowledge base (docs/04-knowledge-base/)

#### 5.1 — `docs/04-knowledge-base/skill-architecture.md`

**Audience:** engineer, qa-lead
**This is one of the most important documents — the skills system is the Certance IP.**

Generate:

- What a SKILL.md file is: structured Markdown consumed by AI agents before acting
- ASCII diagram showing: Agent receives task → reads SKILL.md → reads sub-guide →
  applies rules → produces output
- YAML frontmatter anatomy: every field explained (name, version, applies-when,
  do-not-use-when, agents, transport, foundations)
- How the root `skills/SKILL.md` references sub-guides — show the hierarchy
- Why skills compound in value: each engagement adds patterns; new engineers
  inherit all prior judgment automatically
- Transport modes table: `playwright-cli` (bulk generation) vs `playwright-mcp`
  (exploratory/healing) — when each is used
- Mermaid diagram: skill consumption flow for each agent type

#### 5.2 — `docs/04-knowledge-base/skill-index.md`

**Audience:** engineer

Generate a complete index of ALL skills read in Phase 1.
Table columns: Skill file | Applies when | Key rules enforced | Used by agents
One row per skill file — derive every row from the actual skill files you read.
Group by domain: Core, CI/CD, Page Object Model, Reporting, Migration, Playwright CLI.

After the table, include an ASCII skill map showing the domain groupings:

```
skills/
├── SKILL.md              (root — agents read this first)
├── core/                 (12 skills — fundamental patterns)
├── ci/                   (5 skills — pipeline and environments)
├── pom/                  (2 skills — Page Object patterns)
├── reporting/            (1 skill — Allure taxonomy)
├── migration/            (2 skills — from Selenium, from Cypress)
└── playwright-cli/       (3 skills — CLI transport and sessions)
```

#### 5.3 — `docs/04-knowledge-base/authoring-skills.md`

**Audience:** engineer

Generate:

- When to create a new skill vs extend an existing one
- Full SKILL.md authoring template with every YAML field and section
- The five-question checklist before publishing a skill:
  Is the applies-when precise enough to be unambiguous?
  Does it list what NOT to do as explicitly as what to do?
  Have you tested it by giving it to an agent cold?
  Does it reference related skills?
  Is it under 300 lines?
- Anti-patterns: vague applies-when, conflicting rules, undocumented exceptions

---

### Section 6 — CI/CD (docs/05-ci-cd/)

#### 6.1 — `docs/05-ci-cd/github-actions.md`

**Audience:** engineer

Generate:

- Full pipeline: ASCII diagram of all five jobs (auth-setup, bdd-smoke,
  bdd-regression, heal-on-failure, allure-report) with trigger conditions
  and dependencies
- Each job documented: trigger, runs-on, steps in order, outputs, artifacts
- Concurrency strategy explanation (cancel-in-progress)
- Required secrets table: Secret | Purpose | How to obtain | How to rotate
  (derive from `playwright.yml` — use [REDACT] for values, describe purpose)
- Matrix strategy for bdd-regression (Chromium, Firefox, WebKit)

#### 6.2 — `docs/05-ci-cd/auth-setup.md`

**Audience:** engineer

Generate:

- The STORAGE_STATE_BASE64 pattern explained end-to-end:
  ASCII flow: Login locally → save storageState → base64 encode → store as secret
  → CI decodes → injects into test projects
- Why reCAPTCHA requires this pattern (headless login blocked)
- Step-by-step: how to create a new auth state, encode it, and update the secret
- How to detect auth state expiry (symptoms + fix)
- What `user.json` contains and does not contain (no passwords)
- Multi-role auth extension pattern (admin, viewer)
- Security note: never commit `test-data/.auth/` to version control

#### 6.3 — `docs/05-ci-cd/reporting.md`

**Audience:** engineer, qa-lead

Generate:

- Allure tag taxonomy table: Tag | Values | Purpose | Example
  covering @epic, @feature, @severity (derive from `skills/reporting/allure.md`)
- Allure history: how the 30-run history is preserved via gh-pages branch
- GitHub Pages publishing: URL pattern, when it updates, how to access
- How to view the report locally: `npx allure serve allure-results`
- For QA leads: how to use the Allure dashboard for release readiness decisions

---

### Section 7 — Decision log (docs/06-decision-log/)

Read all five existing ADRs from `docs/decisions/`. Then:

#### 7.1 — Migrate existing ADRs

Copy and reformat each existing ADR (`ADR-001` through `ADR-005`) into
`docs/06-decision-log/` using the Certance ADR template from your agent instructions.
Preserve all existing content — improve formatting only.

#### 7.2 — Generate three new ADRs for undocumented golden rules

**`docs/06-decision-log/ADR-006-locator-hierarchy.md`**
Decision: getByRole() > getByLabel() > getByTestId() — no CSS or XPath
Context: why semantic locators were chosen; what breaks with CSS; accessibility alignment

**`docs/06-decision-log/ADR-007-storage-state-auth.md`**
Decision: STORAGE_STATE_BASE64 for CI authentication
Context: reCAPTCHA blocking headless login; options considered; security implications

**`docs/06-decision-log/ADR-008-skill-knowledge-base.md`**
Decision: SKILL.md structured knowledge base as the agent guidance layer
Context: why plain prompts are insufficient; how skills compound; alternatives considered

For each new ADR, use the options-considered table, decision statement, and
consequences (positive, negative, risks) as specified in your ADR template.

---

### Section 8 — Runbooks (docs/07-runbooks/)

#### 8.1 — `docs/07-runbooks/onboarding.md`

**Audience:** engineer
**Time to complete:** 30 minutes

Generate a runbook that takes a brand-new engineer from zero to running a smoke test.
Every command must be verbatim-correct (derived from `package.json` scripts and
`playwright.yml` environment variables). Include:

- Prerequisites checklist (Node.js version, Git, VS Code, GitHub Copilot)
- Steps: clone → install → configure .env → auth setup → run smoke suite → view report
- Expected output for each step
- Troubleshooting table: 5 most common failure modes with cause and fix

#### 8.2 — `docs/07-runbooks/healing-a-flaky-test.md`

**Audience:** engineer
**Time to complete:** 15 minutes

Generate a runbook for diagnosing and fixing a failing or flaky test. Include:

- Decision tree: is it a locator failure, timing issue, data dependency, or auth expiry?
- ASCII decision tree diagram
- Step-by-step: invoke Healer agent → read failure output → apply fix → verify
- When to use `test.fixme()` vs fix vs escalate

#### 8.3 — `docs/07-runbooks/adding-a-new-page-object.md`

**Audience:** engineer
**Time to complete:** 20 minutes

Generate a step-by-step runbook for adding a new Page Object class. Include:

- When to create a new Page Object vs add methods to an existing one
- Steps: create class extending BasePage → add public methods → register in
  `pages.fixture.ts` → export from `fixtures/index.ts` → write BDD steps
- Code skeleton for a new Page Object (language-tagged TypeScript block)
- Checklist: locators use getByRole/getByLabel, no raw page.click() in spec,
  constructor only takes Page parameter

---

### Section 9 — Contributing (docs/08-contributing/)

#### 9.1 — `docs/08-contributing/golden-rules.md`

**Audience:** engineer

Generate:

- All golden rules from `.github/copilot-instructions.md` as a structured reference
- Each rule: Rule | Rationale | ADR link | Example of violation
- Group by domain: Locators, Assertions, Auth, Page Objects, Test Data, Documentation
- ASCII summary panel at the top — a quick-reference box engineers can screenshot

#### 9.2 — `docs/08-contributing/review-checklist.md`

**Audience:** engineer

Generate a PR review checklist in two parts:

**For test code PRs:**

- [ ] All locators use getByRole / getByLabel / getByTestId — no CSS or XPath
- [ ] No `waitForTimeout()` or arbitrary sleeps anywhere
- [ ] Auth handled via fixture — no inline login
- [ ] All UI interactions in Page Objects — no `page.click()` in spec files
- [ ] No real PII in test data — faker or static fixtures only
- [ ] External APIs mocked with `page.route()` — no real third-party calls
- [ ] New Page Object registered in `fixtures/pages.fixture.ts`
- [ ] BDD scenarios tagged: @smoke, @regression, or @wip

**For documentation PRs:**

- [ ] YAML frontmatter present with all required fields
- [ ] At least one diagram in architecture or flow documents
- [ ] No abbreviations in diagram participants or nodes
- [ ] Related section present with working links
- [ ] No client names or credentials in any document
- [ ] docs/README.md updated with link to new page if applicable

---

## PHASE 3 — Final quality gate (run after all documents are written)

### 3.1 — Cross-reference check

For every internal link in every document (e.g. `[Golden rules](../08-contributing/golden-rules.md)`),
verify the target file was created. List any broken links found.

### 3.2 — Coverage report

Produce a final coverage table:

| Document                                       | Created | Has diagram | Has frontmatter | Has Related section |
| ---------------------------------------------- | ------- | ----------- | --------------- | ------------------- |
| docs/README.md                                 | ✅/❌   | ✅/❌       | ✅/❌           | N/A                 |
| docs/01-introduction/goals-and-requirements.md | ...     | ...         | ...             | ...                 |
| (one row per document)                         |         |             |                 |                     |

### 3.3 — Completion statement

End with:

> "Documentation complete. [N] documents generated. [N] diagrams produced.
> [N] ADRs in decision log. [N] broken links found (list them).
> All files written to docs/. Sync to Confluence via: `mark --space ENG --root docs/`"

---

## Constraints

- Read every file listed in Phase 1 before writing anything
- Generate documents in the exact order listed in Phase 2
- Never invent content not supported by source files
- Never include real credentials, environment URLs, or client names
- Every document must follow the frontmatter + TL;DR + Overview + Related structure
- Flag every assumption with `[VERIFY: <filename>]`
- Do not exceed 400 lines per document — split with anchor links if needed
