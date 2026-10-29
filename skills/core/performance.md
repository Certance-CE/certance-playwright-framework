# Performance Budgets (Core Web Vitals + engine metrics)

> Status: **Proven against the reference app, in CI.** `features/performance.feature`
> measures two signed-in journeys of the self-hosted application on every run
> (REQ-PERF-001/002), `npm run perf:summary` puts the budget table in the CI run summary,
> and `npm run init` scaffolds a performance scenario for your own landing or sign-in page.

Load this guide when: adding performance budgets, measuring Core Web Vitals, or
gating CI on a page-speed regression.

---

## What it measures

Playwright drives a real Chromium, so the `perf` fixture captures **both** layers:

| Layer                            | Metrics                                               | Source                                              |
| -------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| User-perceived (Core Web Vitals) | **LCP**, **CLS**, **INP**, TTFB, FCP                  | Google `web-vitals`, injected into the page         |
| Engine processing (main thread)  | script time, layout, style-recalc, task time, JS heap | Chrome DevTools Protocol (`Performance.getMetrics`) |
| Loading pipeline                 | TTFB, DOMContentLoaded, load, transfer size           | Navigation Timing API                               |

A **budget** is a set of thresholds; a test fails (soft) if any is exceeded.

## Usage

### In Gherkin (no code)

Two steps ship in the core (`features/step-definitions/performance.steps.ts`) and survive
`npm run init`. End any scenario that has just opened a page with one:

```gherkin
@perf @req:REQ-PERF-001
Scenario: The overview loads within the Core Web Vitals budget
  Given I am signed in
  Then the page meets its performance budget

@perf @req:REQ-PERF-002
Scenario: The task list loads within our own budget
  When I open the project
  Then the page meets this performance budget:
    | lcp | 1500 |
    | cls | 0.05 |
```

A misspelt metric (`lpc`) or a non-numeric limit fails the step with the list of valid
names. It is never silently ignored.

### When it measures, and what fails

The fixture waits for the page's `load` event and for LCP and FCP to report (bounded at
10 s), so a page that renders in JavaScript is measured after it paints, not when its DOM
has merely parsed. A metric the budget names but the page never produced is a
violation ("lcp not measured"), not a pass. INP is the one exception: a page has none
until someone interacts with it.

### In a spec

```typescript
import { test } from '../fixtures';

test('checkout is fast enough', async ({ page, perf }) => {
  await page.goto('/checkout');
  // asserts each metric against the budget; attaches metrics to Allure +
  // the perf report; soft-fails on regression (defaults: LCP<2500, CLS<0.1, INP<200).
  await perf.assertBudget({ lcp: 2500, cls: 0.1, scriptMs: 2000 });
});
```

`perf` is **lazy** — it only activates when a test destructures it, so it adds
nothing to the rest of the suite. `perf.collect()` returns the metrics without
asserting. **INP** is only captured when the test drives an interaction (a click).

### Deterministic by construction

The `perf` fixture sits after the `network` fixture, so `mockThirdParties` has
already stripped analytics/telemetry — the numbers aren't polluted by third-party
variance. Combine with `degrade()` to measure **performance under fault**:

```typescript
test('LCP stays acceptable when pricing is slow', async ({ page, degrade, perf }) => {
  await degrade('**/api/pricing', { delay: 3000 });
  await page.goto('/checkout');
  await perf.assertBudget({ lcp: 4000 });
});
```

## Two report views

- **Allure** — the fixture tags results under a **"Performance"** epic, so the
  Allure Behaviors tree gives a filterable performance-only view alongside the
  functional results.
- **Dedicated perf report** — `npm run perf:summary` renders `perf-results/*.json`
  into `performance-report.md` (and the GitHub run summary in CI): one row per
  journey with its vitals, engine time, and budget status.

```bash
npm run test:perf       # every @perf scenario
npm run perf:summary    # render the dedicated report
```

## CI

The suite runs every `@perf` scenario with the rest, and a breach fails it. The CI job
then runs `npm run perf:summary` (report only, so it can never turn a green run red) and
keeps `performance-report.md` and `perf-results/` as a 30-day artifact.

Read the numbers for what they are: the reference app runs on the same CI runner, with no
network between browser and server, so its timings are a regression signal, not a
field measurement. Against a staging environment over a real network they mean more. For
a standardised score, add CPU or network throttling (CDP
`Emulation.setCPUThrottlingRate`) or layer Lighthouse on top.

---
