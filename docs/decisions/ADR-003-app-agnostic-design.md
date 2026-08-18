# ADR-003 — Application-agnostic framework design

**Date:** 2026-03-29  
**Status:** Accepted  
**Deciders:** Certance Lens architecture team

---

## Context

Certance Lens ships with a runnable reference example that targets the public
TodoMVC demo. As the framework is adopted across many different web
applications, it must be deployable to any web application without requiring
architectural changes.

---

## Decision

The framework core (skills, fixtures, utils, CI pipelines, docs) is kept
**completely free of application-specific references**. Only the following
artefacts are application-specific and are replaced per target application:

- `pages/` — application Page Object classes (e.g. `TodoPage`)
- `features/` — Gherkin scenarios and step definitions
- `.env` — base URL and any credentials the target app needs (never committed)

The following are **never** application-specific:

- `skills/core/`, `skills/ci/`, `skills/pom/`, `skills/migration/`
- `fixtures/index.ts` structure (only content changes)
- `playwright.config.ts` structure (only env var names)
- `.github/workflows/` (only env/config values change)

---

## Rationale

- Same framework can be deployed to a new application in under 2 hours
- Core skills and CI knowledge compounds across projects
- AI agents trained on SKILL.md work correctly across all projects
- Certification and training material can reference the framework without app-specific examples

---

## Conventions enforced by this ADR

1. No application-specific product names (the app under test, or any third-party product) in any core file
2. Application URLs live in generically named env vars (e.g. `BASE_URL`), never product-specific ones
3. Feature files use generic personas ("As a user") not product-specific ones
4. Application-specific Page Objects are documented as "must be updated per application"
5. Demo/example files (the TodoMVC reference) are documented as safe to delete when targeting a new application

---

## Consequences

**Positive:**

- New application onboarding time: < 2 hours
- Framework skills accumulate value with each project
- No risk of one application's test artifacts leaking into another

**Negative / trade-offs:**

- Demo/example files (the reference TodoMVC example) must be explicitly deleted when adopting the framework for a new application
- Slightly more documentation overhead per application

---

## Review date

Review when the practice reaches 10+ concurrent projects to assess
whether a template/monorepo structure would be more efficient.
