# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries say what changed **and what it was found to be wrong about**. A framework
whose subject is test honesty should keep an honest history.

## [Unreleased]

### Added

- **API lane** (#15) — the framework exercised against a real REST API with no browser:
  projects, tasks, labels, filtering, and an unauthenticated request that must be
  rejected. Gives the `api` fixture its first consumers.
- **Live contract checks** (#17) — Zod schemas run against what the application actually
  sends, not against stubs written alongside them.
- **Task-management UI showcase** (#19) — a real journey through the demo application,
  seeded over the API and asserted in the browser, with each claim cross-checked at the
  server.
- **Requirement traceability with real requirements** (#14) — `requirements/*.md`,
  `@req:` tags, and the matrix wired into CI. Reports **20/24**, with four gaps
  deliberately recorded rather than hidden.
- **`AGENTS.md`** (#21) — one instruction file for AI coding agents; the other agent
  files now point at it.
- **`docs/GOLDEN_RULES.md`** (#20) — which mechanism enforces each of the twelve rules,
  including why three cannot be enforced by a linter.
- **`framework-tests/`** (#18) — tests of the framework's own helpers, separated from
  tests of the application, plus a README map of where each lane lives.

### Changed

- **Nine of the twelve golden rules are now lint-enforced** (#20), up from five. New
  rules cover fixtures over hooks, test independence, mocking through the `network`
  fixture, synthetic-data-only, and Page Object injection. `force: true`, element
  handles, `networkidle` and `page.$eval` are now rejected.
- **`failOnFlakyTests` in CI** (#16). A test that fails and passes on retry now fails
  the build instead of logging "1 flaky" under a green tick.
- **Security gates actually run** (#11). `continue-on-error` removed from CodeQL;
  Dependency Review enforces `fail-on-severity: high`.

### Fixed

- **CodeQL high-severity alert** (#11) — the CI-summary renderer escaped `|` without
  escaping the escape character first, so a message containing `\|` broke out of the
  Markdown table. Six regression tests, four of which fail against the old code.
- **Three transitive advisories** (#12) — `fast-uri` (2 high), `brace-expansion` (high),
  `qs` (moderate). Each needed a different remedy; `npm audit` now reports zero.
- **Flaky sign-in, twice** (#16, #19). First: the scenario destroyed the session it was
  given and lost a race with the application's own start-up. Fixed structurally, by
  running sign-in scenarios in a project that injects no session. Second: the login
  rate limiter — shared with token refresh, ~8 per IP per minute — was being spent by
  another lane. Fixed by signing in once per run and ordering the lanes.
- **Documentation that taught the bug** (#16, #21) — `skills/core/auth.md` recommended
  the clearing pattern that was flaky, and the Copilot instructions told agents to use
  `page.route()` and faker directly, both of which lint now rejects.

### Known

- `POST /api/v1/tasks/{id}` on the reference application returns an empty `identifier`
  while create, fetch and list return `"#1"`. A defect in the application under test,
  found by the contract checks on their first live run, pinned by a characterisation
  test rather than hidden by loosening the schema.

## [1.0.0] — 2026-08-18

### Added

- Initial public release: Playwright + playwright-bdd, the twelve golden rules, Page
  Objects, fixtures for auth/data/network/a11y/API/cleanup/performance, Allure and CTRF
  reporting, mutation testing, and the agent briefs.
- Self-hosted reference application (#10) — the suite starts it, provisions an account
  and signs in, so the framework is proven against something it does not control.
  Chosen after a hosted candidate passed locally and was blocked by a bot challenge in
  CI. TodoMVC remains as the portability lane.
- SonarQube analysis, unit coverage, and preflight checks (#4, #5).

### Removed

- A home-grown credential-encoding scheme, and `validate-env.js`, which exited non-zero
  on a clean clone of the repository's own reference implementation (#3).

[unreleased]: https://github.com/Certance-CE/certance-playwright-framework/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Certance-CE/certance-playwright-framework/releases/tag/v1.0.0
