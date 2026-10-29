# Certance Lens — Allure Reporting Guide

**Applies to:** All Certance Lens projects
**Reporter:** Allure with allure-playwright integration
**Purpose:** Coverage visibility and stakeholder reporting

Allure is the primary reporting layer. The built-in Playwright HTML report
is for local debugging only. Allure is the report shared with stakeholders.

---

## Setup

Already wired in this repository; nothing to install. For reference:

- **`allure-playwright`** writes `allure-results/` during every run (the reporter entry in
  `playwright.config.ts`).
- **`allure`** (Allure 3, a pure npm package: no Java) turns those results into the report.
  Its configuration is `allurerc.mjs`.
- **`fixtures/allure.fixture.ts`** (auto) labels every test: epic from the area tag, feature
  from the Gherkin `Feature:`, severity from `@smoke`/`@regression`, `requirement` from
  `@req:`. Framework self-tests and session setup get headings of their own, so they never
  mix with the application's results.

## What the customer gets

`npm run report` writes **one standalone HTML file**, `allure-report/index.html`. It opens
from disk, with no server, and holds:

- results grouped **business area → feature → scenario**, with pass/fail counts per level;
- every failure with its message, the exact locator, the call log, the screenshot and the
  **Playwright trace, embedded and viewable inline**;
- **Global Attachments**: the requirement traceability matrix (`npm run coverage:requirements`)
  and the performance budget table (`npm run perf:summary`), rendered as tables;
- **Graphs**: the trend across previous runs (up to 30), results by severity, current status;
- the commit, branch and CI run it came from.

It is a **download, not a published page**, on purpose: it contains screenshots of the
application under test, so where it goes is the reader's decision. To publish it (GitHub
Pages, an internal site), copy that one file; nothing else is needed.

## Tag taxonomy — required on every test

Every test needs an epic, a feature and a severity before it can be counted in a
coverage report. A test without them still runs and still passes — it simply
vanishes from Allure's Behaviors tree, which is the failure mode this taxonomy
exists to prevent.

**In this framework you do not write those three calls.** `fixtures/allure.fixture.ts`
is an auto-fixture that derives them from the Gherkin tags a scenario already
carries, so the taxonomy cannot drift from the tags:

```gherkin
@todos                    # -> epic: Todo list, feature: Todo list  (via EPIC_BY_TAG)
Feature: Todo list

  @smoke                  # -> severity: critical                   (via SEVERITY_BY_TAG)
  @req:REQ-TODO-001       # -> label requirement: REQ-TODO-001
  Scenario: Add a todo
```

The one thing you must maintain is the map. A feature-area tag with **no entry**
in `EPIC_BY_TAG` produces a scenario with no epic and no feature label — it runs,
it passes, and it is invisible in the report. Add an entry whenever you add an area:

```typescript
// fixtures/allure.fixture.ts
const EPIC_BY_TAG: Record<string, string> = {
  authentication: 'Authentication',
  todos: 'Todo list',
};
```

For a non-BDD spec, or to override the mapping for one test, call the
`allure-js-commons` helpers directly:

```typescript
import { epic, feature, severity } from 'allure-js-commons';

test('user can complete checkout with card payment', async ({ page }) => {
  await epic('Commerce');
  await feature('Checkout');
  await severity('critical');

  // test body
});
```

### Epic — business domain

Maps to a top-level product area or business capability. Keep to 5–10
epics per project. Examples:

| Epic             | Covers                                     |
| ---------------- | ------------------------------------------ |
| `Authentication` | Login, SSO, MFA, session management        |
| `Commerce`       | Cart, checkout, payments, orders           |
| `Search`         | Global search, filters, results navigation |
| `Reporting`      | Dashboards, exports, scheduled reports     |
| `Administration` | User management, permissions, settings     |
| `Notifications`  | Email, in-app, webhooks                    |

### Feature — specific feature within the epic

One level below epic. Maps to a user-facing feature or user story group.
Examples within `Commerce`:

- `Cart management`
- `Checkout flow`
- `Payment processing`
- `Order confirmation`
- `Refunds and returns`

### Severity — business impact of failure

| Level      | When to use                                         |
| ---------- | --------------------------------------------------- |
| `critical` | Failure blocks a core user journey or revenue flow  |
| `normal`   | Failure degrades experience but a workaround exists |
| `minor`    | Edge case — low user impact                         |
| `trivial`  | Cosmetic or non-functional validation               |

**Rule:** Do not use `critical` liberally. If everything is critical,
nothing is. Reserve it for flows that directly block user value delivery
or regulatory compliance.

---

## Owner and story ID tags (optional but recommended)

```typescript
allure.owner('QA Lead');
allure.tag('regression');
allure.tag('smoke');
allure.link('https://your-tracker.example.com/browse/STORY-123', 'Story', 'issue');
```

Linking tests to stories enables gap analysis against the backlog directly.

---

## Running and generating reports locally

```bash
npm test                        # writes allure-results/
npm run coverage:requirements   # requirements-coverage.md
npm run perf:summary            # performance-report.md
npm run report                  # allure-report/index.html — open it in a browser
```

`allure-results/` accumulates across local runs; delete it before a run when you want a
report of that run alone. History lives in `allure-history/history.jsonl` (git-ignored).

## CI: the quality-report artifact

The BDD job runs the steps above, then:

1. restores `allure-history/` from the Actions cache (the branch's own history, or `main`'s
   for a new branch);
2. runs `npm run report`;
3. saves the updated history back to the cache;
4. uploads `allure-report/index.html` as the **`quality-report`** artifact (kept 30 days).

Every step runs `if: always()`, so a failing run still produces its report: that is the run
a customer most needs to read. The report name comes from `certance.reportName` in
`package.json`, which `npm run init` sets to `<your app> — quality report`.

## Gap report template (for stakeholders)

Use this structure when delivering coverage reports. Translate tag
data into business language — not percentages engineers can argue with.

```
Coverage Report — [Project] — [Date]

OVERALL COVERAGE
Total scenarios mapped:        [N]
Automated and passing:         [N] ([%])
Automated and failing:         [N]
Not yet automated:             [N]

COVERAGE BY EPIC
Epic                  Scenarios   Covered   Critical paths   Status
Authentication        12          12        4 / 4            ✅ Full
Checkout              18          14        3 / 4            ⚠️  Gap
Search                8           3         1 / 3            ❌ Partial
Reporting             6           0         0 / 2            ❌ Not started

IDENTIFIED GAPS (business risk framing)
1. Checkout — Guest checkout not automated
   Risk: Payment flow failure undetected until manual regression
   Severity: HIGH — revenue-critical path

2. Search — Filter combinations not covered
   Risk: Search degradation missed in CI
   Severity: MEDIUM — affects discoverability

3. Reporting — No automated coverage
   Risk: Export failures reach production undetected
   Severity: HIGH — compliance-relevant

RECOMMENDATION
Prioritise gaps 1 and 3 in the next sprint. Estimated 2–3 days
of automation work to achieve full critical path coverage.
```

---

## Common mistakes

**Do not do this:**

```gherkin
# The tag carries no EPIC_BY_TAG entry, so this scenario has no epic and no
# feature label. It passes, and it is invisible in the Behaviors tree.
@checkout
Feature: Checkout
```

**Do this** — add the area to the map once, and every scenario tagged with it
inherits the taxonomy:

```typescript
// fixtures/allure.fixture.ts
const EPIC_BY_TAG: Record<string, string> = {
  authentication: 'Authentication',
  todos: 'Todo list',
  checkout: 'Commerce',
};
```

---

## Guide metadata

Guide version: 1.0.0
Reporter: allure-playwright ^3.x
Last reviewed: August 2026
