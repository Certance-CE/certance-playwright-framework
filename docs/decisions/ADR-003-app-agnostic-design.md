# ADR-003 — Application-agnostic framework design

**Date:** 2026-03-29  
**Status:** Accepted  
**Deciders:** Certance Advisory architecture team

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
artefacts are application-specific and are replaced per client engagement:

- `pages/` — Page Object classes
- `features/` — Gherkin scenarios and step definitions
- `plans/` — Planner agent output
- `tests/seed.spec.ts` — the post-login assertion
- `pages/BasePage.ts → assertAppLoaded()` — the post-login check
- `.env` — credentials and URLs (never committed)

The following are **never** application-specific:

- `skills/core/`, `skills/ci/`, `skills/pom/`, `skills/migration/`
- `fixtures/index.ts` structure (only content changes)
- `playwright.config.ts` structure (only env var names)
- `.github/workflows/` (only secret names)

---

## Rationale

- Same framework can be deployed to a new client in under 2 hours
- Core skills and CI knowledge compounds across engagements
- AI agents trained on SKILL.md work correctly across all client projects
- Certification and training material can reference the framework without app-specific examples

---

## Conventions enforced by this ADR

1. No application-specific product names (the app under test, or any third-party product) in any core file
2. Application URLs live in generically named env vars (e.g. `APP_LIST_URL`), never product-specific ones
3. Feature files use generic personas ("As a user") not product-specific ones
4. `BasePage.assertAppLoaded()` is documented as "must be updated per client"
5. `tests/seed.spec.ts` post-login assertion is documented as "must be updated per client"
6. `docs/ONBOARDING.md` Step 7 explicitly lists demo files to delete

---

## Consequences

**Positive:**

- New client onboarding time: < 2 hours
- Framework skills accumulate value with each engagement
- No risk of shipping one client's test artifacts to another

**Negative / trade-offs:**

- Demo/example files (the reference TodoMVC example) must be explicitly deleted during onboarding
- Slightly more documentation overhead per client engagement

---

## Review date

Review when the practice reaches 10+ concurrent client engagements to assess
whether a template/monorepo structure would be more efficient.
