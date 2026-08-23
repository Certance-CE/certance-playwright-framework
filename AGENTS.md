# AGENTS.md

Instructions for AI coding agents working in this repository. Human contributors want
[CONTRIBUTING.md](CONTRIBUTING.md); this file is the single source agents read, and
every other agent-instruction file in the repo points here rather than restating it.

## What this is

**Certance Lens** — an opinionated Playwright + BDD test-automation framework. The
core is application-agnostic; the reference implementation exercises it against a real
application so the claims are demonstrable rather than asserted.

Playwright · TypeScript · playwright-bdd (Cucumber) · GitHub Actions · Allure

## Setup

```bash
npm install
npm run setup      # fetches the demo application + the Chromium build
npm test           # green on a cold clone, no secrets required
```

`npm run setup` downloads a ~47 MB archive (112 MB on disk). Set `BASE_URL` to point
at your own application and the download is skipped entirely.

## The four lanes

Read this before concluding that tests are missing. `tests/` holds tests **of the
application**; `framework-tests/` holds tests of this framework's own helpers.

| Lane                 | Source                          | Runs against                    | Command                 |
| -------------------- | ------------------------------- | ------------------------------- | ----------------------- |
| API                  | `tests/api/*.api.spec.ts`       | demo app's REST API, no browser | `npm run test:api`      |
| App UI               | `features/*.feature`            | demo app, signed in and out     | `npm run test:app`      |
| Portability          | `features/*.feature` (`@todos`) | TodoMVC                         | `npm run bdd:test`      |
| Framework self-tests | `framework-tests/`              | nothing — fully offline         | `npm run test:examples` |

**The UI specs are generated.** You edit Gherkin in `features/*.feature`;
`npm run bdd:gen` writes runnable specs into `.features-gen/`. Never edit
`.features-gen/` — it is overwritten. Every `test:*` and `bdd:*` script regenerates
first.

## The rules, and what enforces them

Twelve golden rules in [skills/SKILL.md](skills/SKILL.md). **Nine are enforced by
lint**, so `npm run lint` will reject a violation before review does.

[docs/GOLDEN_RULES.md](docs/GOLDEN_RULES.md) maps each rule to its mechanism. The ones
that most often catch generated code:

- **Locators** — `getByRole` → `getByLabel` → `getByTestId`. Never `.locator()`,
  `page.$`, CSS or XPath. Text locators only inside `pages/`.
- **Page Objects** — no `page.click/fill/press` in a spec or step definition. Drive
  the UI through a class in `pages/`, and receive it from a fixture: never
  `new SomePage(page)` outside a setup project.
- **Fixtures, not hooks** — no `test.beforeEach`. Shared setup goes in `fixtures/`.
- **Mocking** — use the `network` fixture (`mock`, `degrade`). Raw `page.route()` is
  rejected.
- **Test data** — use the `data` fixture. A literal email address or a direct
  `@faker-js/faker` import is rejected.
- **Assertions** — web-first only. No `waitForTimeout`, no `networkidle`, no
  `{ force: true }`, no element handles.

`{ force: true }` deserves a note: it switches off the actionability checks that tell
you a control is invisible, disabled or covered. When a control cannot be clicked,
find the path a real user takes — this repo activates a screen-reader-only checkbox
from the keyboard (`pages/ProjectPage.ts`) rather than forcing it.

## Constraints of the demo application

These are properties of the application under test, not of the framework. Working
against them produces flake that looks like a broken locator.

- **SQLite serialises writes.** Concurrent writers get HTTP 500. Every lane that
  writes runs `workers: 1` via `SERIALISED_WRITES` in `playwright.config.ts`.
- **Sign-in is rate limited** — roughly 8 per IP per minute, keyed by IP, counting
  failures, and shared with `/user/token/refresh`, which a single-page application
  spends freely. Do not add logins casually, and do not hunt flake with
  `--repeat-each`: it manufactures the failure it is meant to detect. See
  [skills/core/auth.md](skills/core/auth.md).

## Requirements and traceability

Requirements live in `requirements/*.md`. A scenario claims one with a
`@req:REQ-AREA-NNN` tag, and `npm run coverage:requirements` produces the matrix.

When you add coverage, add or update the requirement too. When something is
**deliberately** untested, record it as a requirement with no scenario and say why —
the matrix is meant to show the real edge of coverage, not the edge of what was
convenient.

## Before you open a pull request

```bash
npm run lint          # golden rules; --max-warnings=0
npm run typecheck
npm run test:unit     # includes tests OF the lint rules themselves
npm run check:docs    # every npm script and path referenced in Markdown resolves
```

CI additionally runs mutation testing (70% threshold) and `failOnFlakyTests`: a test
that fails and then passes on retry **fails the build**. If you see a flake, diagnose
it — do not add a retry.

## Working style

- Verify against the running application rather than reasoning about it. Several
  documented behaviours in this repo were wrong until someone actually ran them.
- When a test fails, establish whether it is a test defect or a product defect before
  changing the test. A characterisation test that records real broken behaviour is
  better than a loosened assertion that hides it.
- Prefer deleting a claim to weakening a check.
