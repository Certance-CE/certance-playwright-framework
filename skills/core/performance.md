# Performance Budgets (Core Web Vitals + engine metrics)

> Status: **Implemented** — the `perf` fixture (`fixtures/perf.fixture.ts`).

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
npm run test:perf       # run tests/performance/*.perf.spec.ts
npm run perf:summary    # render the dedicated report
```

## CI note

The harness runs fully offline (see `tests/performance/example.perf.spec.ts`).
**Real budgets need the live app** and journey-specific thresholds — wire a
`test:perf` step into CI once budgets are tuned, and gate with
`PERF_FAIL_ON_BUDGET=1`. Raw numbers on a fast CI box read optimistically; for a
standardized, comparable score apply CPU/network throttling (CDP
`Emulation.setCPUThrottlingRate`) or layer Lighthouse on top.

---
