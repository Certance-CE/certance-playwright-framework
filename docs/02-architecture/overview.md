---
title: 'Architecture Overview'
section: 'arc42 §3 — System Scope and Context'
audience: all
status: stable
last-updated: 2026-05-10
---

# Architecture Overview

> **Audience:** All — engineers, QA leads, and engineering leadership
> **TL;DR:** The Certance framework is an AI-native Playwright test system where four specialised agents collaborate to plan, generate, review, and heal automated tests — eliminating the manual effort that makes enterprise test suites fragile.

## Overview

Enterprise test automation fails not because engineers lack skill, but because the feedback loop between application change and test maintenance is too slow and too manual. The Certance framework addresses this by embedding AI agents directly into the testing lifecycle: one agent plans, one generates, one reviews, and one heals — each with a defined scope, toolset, and handoff protocol.

The framework is built on Playwright and TypeScript with a BDD layer (Gherkin + Cucumber), deployed on GitHub Actions CI, and reported through Allure. Every design decision is encoded in a structured knowledge base (`skills/`) that agents read before acting, ensuring consistent output across engineers and engagements.

---

## System context

The diagram below shows the Certance framework in its operating environment: who interacts with it, what external systems it depends on, and what it produces.

```mermaid
C4Context
  title System Context — Certance Playwright Framework

  Person(qaEngineer, "QA Engineer", "Authors tests, reviews agent output, maintains skills")
  Person(qaLead, "QA Lead / Tech Lead", "Reviews coverage reports, approves ADRs, governs framework standards")
  Person(ciSystem, "CI System", "GitHub Actions — triggers test runs on push and PR")

  System_Boundary(certance, "Certance Framework") {
    System(framework, "Certance Lens", "AI-native test automation system: agents, Page Objects, fixtures, BDD layer, skills knowledge base")
  }

  System_Ext(app, "Application Under Test", "Target web application (the TodoMVC reference example, or your own app)")
  System_Ext(github, "GitHub", "Source control, Actions CI/CD, Pages for Allure report hosting")
  System_Ext(allure, "Allure Report", "Test results dashboard published to GitHub Pages after every CI run")
  System_Ext(claude, "Claude Code (Anthropic)", "AI backend for Generator and Healer agents")
  System_Ext(copilot, "GitHub Copilot", "AI backend for Planner and Reviewer agents in VS Code")
  System_Ext(confluence, "Confluence", "Documentation publishing target via mark CLI sync")

  Rel(qaEngineer, framework, "Authors feature files, invokes agents, reviews generated tests")
  Rel(qaLead, framework, "Reviews coverage, governs standards, reads architecture docs")
  Rel(ciSystem, framework, "Triggers on push/PR; runs smoke suite; publishes Allure report")
  Rel(framework, app, "Executes Playwright tests against")
  Rel(framework, github, "Hosted on; CI runs on Actions; Allure report published to Pages")
  Rel(framework, allure, "Publishes test results after each CI run")
  Rel(framework, claude, "Generator and Healer agents use Claude Sonnet 4 via MCP")
  Rel(framework, copilot, "Planner and Reviewer agents run on GitHub Copilot in VS Code")
  Rel(framework, confluence, "Docs synced via mark CLI on merge to main")
```

---

## What the framework is not

Understanding the boundary prevents common misuse:

| Not in scope                | Why                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Unit or component testing   | Playwright tests browser interactions; use Vitest/Jest for unit tests              |
| API testing in isolation    | `page.route()` is used for mocking only; dedicated API testing is a separate layer |
| Performance or load testing | Use k6 or equivalent; Playwright is not a load testing tool                        |
| Manual test management      | The framework automates execution; test case management (Jira, Xray) is separate   |

---

## Quality outcomes

The framework exists to solve three measurable business problems:

| Problem                                          | How the framework addresses it                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Fragile test suites that break on every release  | AI Healer agent detects and patches broken locators automatically; web-first assertions eliminate timing failures                      |
| Coverage that nobody trusts                      | BDD Gherkin features are the source of truth — business scenarios map directly to test execution                                       |
| Test maintenance cost that scales with headcount | Agent pipeline generates and heals tests; knowledge base (SKILL.md) encodes judgment so junior engineers produce senior-quality output |

---

## Related

- [Component map](component-map.md) — internal structure: Page Objects, fixtures, BDD layer, skills
- [Agent pipeline](agent-pipeline.md) — how Planner, Generator, Reviewer, and Healer collaborate
- [Tools and integrations](tools-and-integrations.md) — Playwright, Claude Code, Copilot, Allure, GitHub Actions
- [Goals and requirements](../01-introduction/goals-and-requirements.md) — why this framework exists
