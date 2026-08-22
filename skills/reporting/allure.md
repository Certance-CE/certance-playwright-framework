# Certance Lens — Allure Reporting Guide

**Applies to:** All Certance Lens projects
**Reporter:** Allure with allure-playwright integration
**Purpose:** Coverage visibility and stakeholder reporting

Allure is the primary reporting layer. The built-in Playwright HTML report
is for local debugging only. Allure is the report shared with stakeholders.

---

## Setup

### Install dependencies

```bash
npm install --save-dev allure-playwright allure-commandline
```

### playwright.config.ts — add Allure reporter

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['html'], // local debugging only
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'allure-results',
        suiteTitle: false,
      },
    ],
  ],
  // ... rest of config
});
```

---

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
# Run tests and generate results
npx playwright test

# Generate HTML report from results
npx allure generate allure-results --clean -o allure-report

# Open report in browser
npx allure open allure-report
```

Add to `.gitignore`:

```
allure-results/
allure-report/
```

---

## CI publishing — GitHub Actions

Add these steps to your test job, after the Playwright run:

```yaml
- name: Run Playwright tests
  run: npx playwright test
  env:
    BASE_URL: ${{ secrets.BASE_URL }}

- name: Generate Allure report
  if: always()
  run: npx allure generate allure-results --clean -o allure-report

- name: Upload Allure report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: allure-report-${{ github.run_number }}
    path: allure-report/
    retention-days: 30

- name: Upload raw Allure results (for trend tracking)
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: allure-results-${{ github.run_number }}
    path: allure-results/
    retention-days: 30
```

**Note:** Upload both the generated report and the raw results. Raw results
are needed for Allure trend charts across runs.

---

## Trend history in CI

To enable trend charts (pass rate over time), carry the history folder
forward between runs:

```yaml
- name: Download previous Allure history
  uses: actions/download-artifact@v4
  with:
    name: allure-history
    path: allure-results/history
  continue-on-error: true # first run will have no history

- name: Generate Allure report with history
  if: always()
  run: npx allure generate allure-results --clean -o allure-report

- name: Save Allure history for next run
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: allure-history
    path: allure-report/history/
    retention-days: 90
```

---

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
