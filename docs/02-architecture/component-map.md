---
title: 'Component Map'
section: 'arc42 §5 — Building Block View'
audience: engineer, qa-lead
status: stable
last-updated: 2026-05-10
---

# Component Map

> **Audience:** Engineers and QA leads who need to understand what the framework contains and how the parts fit together
> **TL;DR:** The framework has four runtime components (Page Objects, Fixtures, BDD Layer, Tests) and two support systems (Skills knowledge base, AI Agents). They compose via TypeScript imports and Playwright fixtures — nothing is hidden or magic.

## Overview

The Certance framework is a single TypeScript monorepo. There are no micro-services, no separate deployables, and no runtime infrastructure beyond a browser. The complexity is in the composition: Page Objects encapsulate UI interactions, Fixtures wire Page Objects into tests, the BDD layer translates Gherkin into Playwright calls, and the Skills knowledge base gives AI agents the judgment to generate correct code.

---

## Container diagram

```mermaid
C4Container
  title Container Diagram — Certance Framework

  Person(engineer, "QA Engineer", "Writes features, invokes agents, reviews output")

  System_Boundary(certance, "Certance Framework (TypeScript monorepo)") {
    Container(bdd, "BDD Layer", "playwright-bdd / Cucumber", "Gherkin .feature files compiled to Playwright specs via bddgen")
    Container(tests, "Spec Files", "Playwright / TypeScript", "Direct test specs for non-BDD scenarios (tests/, specs/)")
    Container(pages, "Page Objects", "TypeScript classes", "Encapsulate all UI interactions; consumed by fixtures")
    Container(fixtures, "Fixtures", "Playwright fixtures API", "Compose Page Objects; inject auth state; single source of truth for test setup")
    Container(skills, "Knowledge Base", "Markdown (SKILL.md)", "Structured guidance for AI agents; encodes framework patterns and rules")
    Container(agents, "Agent Profiles", "GitHub Copilot agent .md", "Specialised AI agents: Planner, Generator, Healer, Technical Writer")
    Container(utils, "Utilities", "TypeScript modules", "env.ts, test-data.ts, obfuscation.ts — shared helpers")
    Container(ci, "CI Pipeline", "GitHub Actions YAML", "auth-setup → bdd-smoke → bdd-regression → heal-on-failure → allure-report")
  }

  System_Ext(playwright, "Playwright", "Browser automation engine")
  System_Ext(app, "Application Under Test", "Target web application")

  Rel(engineer, bdd, "Writes .feature files")
  Rel(engineer, agents, "Invokes agents in VS Code Copilot Chat")
  Rel(bdd, fixtures, "Imports test object from fixtures/index.ts")
  Rel(tests, fixtures, "Imports test object from fixtures/index.ts")
  Rel(fixtures, pages, "Instantiates and injects Page Object instances")
  Rel(pages, playwright, "Uses Page API for all browser interactions")
  Rel(playwright, app, "Controls browser against")
  Rel(agents, skills, "Read SKILL.md before generating or healing any code")
  Rel(ci, bdd, "Runs bddgen then playwright test --grep @smoke / @regression")
```

---

## Component diagram — Page Objects layer

Six Page Object classes, all extending `BasePage`. Every class receives a `Page` instance through the constructor — never created directly in tests (fixtures handle that).

```mermaid
C4Component
  title Component Diagram — Page Objects (pages/)

  Container_Boundary(pages, "pages/") {
    Component(base, "BasePage", "BasePage.ts", "Abstract base: waitForApp(), assertWorkspaceLoaded(). All Page Objects extend this.")
    Component(login, "LoginPage", "LoginPage.ts", "Login form interactions: fill credentials, submit, assert authenticated state")
    Component(taskList, "TaskListPage", "TaskListPage.ts", "Task list view: create task button, list navigation, task item selection")
    Component(taskCreate, "TaskCreateModal", "TaskCreateModal.ts", "Task creation modal: name input, assignee, due date, submit")
    Component(taskDetail, "TaskDetailPage", "TaskDetailPage.ts", "Task detail view: title, description, status, comments")
    Component(search, "SearchModal", "SearchModal.ts", "Global search modal: query input, results list, navigation")
  }

  Rel(login, base, "extends")
  Rel(taskList, base, "extends")
  Rel(taskCreate, base, "extends")
  Rel(taskDetail, base, "extends")
  Rel(search, base, "extends")
```

---

## Component diagram — Fixtures layer

Two fixture files compose into a single `test` export. `pages.fixture.ts` wires every Page Object. `index.ts` is the composition root — all tests and step definitions import from here.

```mermaid
C4Component
  title Component Diagram — Fixtures (fixtures/)

  Container_Boundary(fixtures, "fixtures/") {
    Component(index, "index.ts", "Composition root", "Re-exports composed test object and expect. Single import point for all tests.")
    Component(pagesFixture, "pages.fixture.ts", "Page Object fixtures", "Defines loginPage, taskListPage, taskCreateModal, taskDetailPage, searchModal fixtures. Extends playwright-bdd base.")
  }

  System_Ext(bddBase, "playwright-bdd base test", "Base test object from playwright-bdd")
  System_Ext(pageObjects, "Page Object classes", "pages/*.ts")

  Rel(index, pagesFixture, "imports and re-exports")
  Rel(pagesFixture, bddBase, "extends with test.extend()")
  Rel(pagesFixture, pageObjects, "instantiates on each test via async ({ page }, use) => { await use(new XPage(page)) }")
```

---

## Component diagram — Skills knowledge base

The knowledge base is consumed exclusively by AI agents. It is never imported by TypeScript code. Each skill file is a structured Markdown document with YAML frontmatter declaring when it applies.

```mermaid
C4Component
  title Component Diagram — Skills Knowledge Base (skills/)

  Container_Boundary(skills, "skills/") {
    Component(root, "SKILL.md", "Root skill", "Entry point — agents read this first. References all sub-guides.")
    Component(coreAuth, "core/auth.md", "Auth patterns", "STORAGE_STATE_BASE64 pattern, seed spec, multi-role auth, expiry handling")
    Component(coreLocators, "core/locators.md", "Locator strategy", "getByRole > getByLabel > getByTestId hierarchy, anti-patterns")
    Component(coreAssertions, "core/assertions.md", "Assertions", "Web-first assertions, expect API, anti-patterns")
    Component(coreFixtures, "core/fixtures.md", "Fixtures guide", "Fixture composition, auth injection, test data fixtures")
    Component(coreMocking, "core/mocking.md", "Mocking", "page.route() patterns, external API mocking, response interception")
    Component(coreTestData, "core/test-data.md", "Test data", "faker usage, PII rules, static data files")
    Component(pom, "pom/patterns.md", "POM patterns", "Page Object conventions, naming, lifecycle, component objects")
    Component(ci, "ci/github-actions.md", "CI guide", "GitHub Actions matrix strategy, secrets, auth-setup job")
    Component(reporting, "reporting/allure.md", "Allure reporting", "epic/feature/severity tag taxonomy, history, GitHub Pages")
    Component(migration, "migration/", "Migration guides", "from-selenium.md, from-cypress.md — migration patterns")
    Component(playwrightCli, "playwright-cli/", "Playwright CLI", "MCP server reference, YAML flows, session management")
  }

  Rel(root, coreAuth, "references")
  Rel(root, coreLocators, "references")
  Rel(root, pom, "references")
  Rel(root, ci, "references")
  Rel(root, reporting, "references")
```

---

## How the layers compose at test execution time

```mermaid
sequenceDiagram
  participant F as Feature file (.feature)
  participant BDD as bddgen (playwright-bdd)
  participant SD as Step definitions
  participant FX as fixtures/index.ts
  participant PO as Page Object (pages/)
  participant PW as Playwright

  F->>BDD: npm run bdd:gen
  BDD->>SD: Generates .features-gen/ spec wrapping step definitions
  SD->>FX: import { test } from '../../fixtures'
  FX->>PO: Instantiates e.g. new TaskListPage(page)
  PO->>PW: getByRole(), click(), fill(), expect()
  PW-->>PO: Returns locators and assertions
  PO-->>SD: Step implementation completes
```

---

## Related

- [Overview](overview.md) — system context and external actors
- [Agent pipeline](agent-pipeline.md) — how agents interact with this component structure
- [Framework structure — Page Objects](../03-framework-structure/page-objects.md) — per-class documentation
- [Framework structure — Fixtures](../03-framework-structure/fixtures.md) — fixture usage guide
