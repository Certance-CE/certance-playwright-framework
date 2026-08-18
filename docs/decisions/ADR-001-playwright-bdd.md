# ADR-001 — Use playwright-bdd over raw Cucumber.js

**Date:** 2026-01-15  
**Status:** Accepted  
**Deciders:** Certance Advisory architecture team

---

## Context

The framework needs a BDD layer so that business stakeholders can read,
challenge, and sign off test scenarios without reading TypeScript. The
two primary options were raw Cucumber.js and playwright-bdd.

---

## Decision

Use `playwright-bdd` as the BDD adapter — Gherkin `.feature` files compiled
to Playwright Test spec files at pre-test time via `npm run bdd:gen`.

---

## Rationale

`playwright-bdd` runs **inside** the Playwright Test runner. This means:

- Full access to Playwright fixtures in step definitions
- Uses the same `expect` API and web-first assertions
- Same reporters (HTML, JSON) — no separate Cucumber HTML reports
- Same retry mechanism, trace output, screenshot-on-failure
- CI uses a single `npx playwright test` command — no Cucumber CLI needed
- TypeScript-first: step definitions are fully typed

Raw Cucumber.js would require a separate runner, its own reporters, and
manual wiring of Playwright browser contexts — duplicating infrastructure
and diverging from Playwright's feature set.

---

## Alternatives considered

| Alternative                    | Why rejected                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Raw Cucumber.js                | Separate runner, separate reporters, no fixture integration, extra complexity                 |
| No BDD layer (pure spec files) | Non-technical stakeholders cannot review or sign off scenarios                                |
| WebdriverIO + Cucumber         | Different browser automation layer — loses Playwright's trace viewer and web-first assertions |

---

## Consequences

**Positive:**

- All tests run through a single runner with unified reporting
- Business-readable Gherkin scenarios are the contract with clients
- Full Playwright fixture system available in step definitions

**Negative / trade-offs:**

- `npm run bdd:gen` must be run before every test run (automated in CI)
- Generated `.features-gen/` files must not be edited manually

**Risks:**

- `playwright-bdd` is a third-party library — monitor for maintenance status

---

## Review date

Review at next major Playwright version upgrade or if `playwright-bdd` becomes unmaintained.
