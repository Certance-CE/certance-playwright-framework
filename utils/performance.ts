import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Performance measurement helpers (see skills/core/performance.md).
 *
 * Captures BOTH layers Playwright can reach in a real Chromium:
 *  - user-perceived Core Web Vitals — LCP / CLS / INP / TTFB / FCP — via Google's
 *    `web-vitals` library injected into the page;
 *  - engine processing metrics — main-thread script / layout / style-recalc time,
 *    long-task time, and JS heap — via the Chrome DevTools Protocol.
 *
 * A *budget* is a set of thresholds; `evaluateBudget` returns the violations so a
 * test can gate on regression. Results are written to `perf-results/` for the
 * dedicated report (`npm run perf:summary`).
 */

// The web-vitals IIFE bundle, read once and injected into the page before load.
const WEB_VITALS_IIFE = readFileSync(join(dirname(require.resolve('web-vitals')), 'web-vitals.iife.js'), 'utf8');

/** Init script: load web-vitals, then stream every metric onto window.__PERF_VITALS__. */
export const PERF_INIT_SCRIPT = `${WEB_VITALS_IIFE}
;(function () {
  var P = (window.__PERF_VITALS__ = { lcp: null, cls: null, inp: null, ttfb: null, fcp: null });
  var opts = { reportAllChanges: true };
  webVitals.onLCP(function (m) { P.lcp = m.value; }, opts);
  webVitals.onCLS(function (m) { P.cls = m.value; }, opts);
  webVitals.onINP(function (m) { P.inp = m.value; }, opts);
  webVitals.onTTFB(function (m) { P.ttfb = m.value; }, opts);
  webVitals.onFCP(function (m) { P.fcp = m.value; }, opts);
})();`;

/** All numeric metrics a collect() call can return (ms, except cls = unitless, heap = MB). */
export interface PerfMetrics {
  lcp?: number | null; // Largest Contentful Paint (ms)
  cls?: number | null; // Cumulative Layout Shift (unitless)
  inp?: number | null; // Interaction to Next Paint (ms) — needs interaction
  ttfb?: number | null; // Time To First Byte (ms)
  fcp?: number | null; // First Contentful Paint (ms)
  domContentLoaded?: number; // ms
  load?: number; // ms
  transferKB?: number;
  scriptMs?: number; // main-thread JS execution
  layoutMs?: number;
  recalcStyleMs?: number;
  taskMs?: number; // total main-thread task time
  jsHeapMB?: number;
}

export type PerfBudget = Partial<Record<keyof PerfMetrics, number>>;

/** Good-by-default thresholds (Core Web Vitals "good" + sane processing limits). */
export const DEFAULT_BUDGET: PerfBudget = {
  lcp: 2500,
  cls: 0.1,
  inp: 200,
  ttfb: 800,
  scriptMs: 2000,
};

export interface BudgetViolation {
  metric: keyof PerfMetrics;
  value: number;
  limit: number;
}

/** Compare metrics against a budget; return every threshold that was exceeded. */
export function evaluateBudget(metrics: PerfMetrics, budget: PerfBudget = DEFAULT_BUDGET): BudgetViolation[] {
  const violations: BudgetViolation[] = [];
  for (const key of Object.keys(budget) as (keyof PerfMetrics)[]) {
    const limit = budget[key];
    const value = metrics[key];
    if (typeof limit === 'number' && typeof value === 'number' && value > limit) {
      violations.push({ metric: key, value, limit });
    }
  }
  return violations;
}

export interface PerfRecord {
  name: string;
  url: string;
  metrics: PerfMetrics;
  budget: PerfBudget;
  violations: BudgetViolation[];
}

const PERF_DIR = process.env.PERF_RESULTS_DIR || 'perf-results';

/** Persist one measurement for the dedicated perf report (scripts/perf-summary.js). */
export function writePerfRecord(record: PerfRecord): void {
  mkdirSync(PERF_DIR, { recursive: true });
  const safe = record.name.replace(/[^\w.-]+/g, '_').slice(0, 80);
  writeFileSync(join(PERF_DIR, `${safe}.json`), JSON.stringify(record, null, 2));
}
