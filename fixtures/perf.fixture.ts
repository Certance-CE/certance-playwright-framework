import { test as cleanupTest } from './cleanup.fixture';
import { expect, type CDPSession } from '@playwright/test';
import { epic, label, attachment } from 'allure-js-commons';
import {
  PERF_INIT_SCRIPT,
  DEFAULT_BUDGET,
  evaluateBudget,
  writePerfRecord,
  type PerfMetrics,
  type PerfBudget,
} from '../utils/performance';

/**
 * `perf` fixture — Core Web Vitals + engine processing metrics + budgets.
 *
 * Lazy: only activates when a test destructures `perf`, so it adds nothing to the
 * rest of the suite. On use it injects web-vitals (before navigation) and opens a
 * CDP session; the test navigates, then calls `perf.assertBudget()`.
 *
 *   test('home page is fast enough', async ({ page, perf }) => {
 *     await page.goto('/');
 *     await perf.assertBudget({ lcp: 2500, cls: 0.1 });
 *   });
 *
 * See skills/core/performance.md. Chromium-only (uses CDP).
 */
export interface Perf {
  /** Collect the current metrics without asserting. */
  collect(): Promise<PerfMetrics>;
  /** Collect, compare to a budget, attach to Allure + the perf report, soft-fail on regression. */
  assertBudget(budget?: PerfBudget): Promise<PerfMetrics>;
}

export const test = cleanupTest.extend<{ perf: Perf }>({
  perf: async ({ page }, use, testInfo) => {
    await page.addInitScript({ content: PERF_INIT_SCRIPT });
    const cdp: CDPSession = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');

    const collect = async (): Promise<PerfMetrics> => {
      // Flush paint observers (2 frames) so LCP/CLS/FCP report before we read them.
      const vitals = await page.evaluate(async () => {
        const g = globalThis as unknown as {
          requestAnimationFrame: (cb: () => void) => number;
          __PERF_VITALS__?: Record<string, number | null>;
        };
        await new Promise<void>((resolve) => g.requestAnimationFrame(() => g.requestAnimationFrame(() => resolve())));
        return g.__PERF_VITALS__ ?? {};
      });
      const nav = await page.evaluate(() => {
        const perfApi = globalThis.performance as unknown as {
          getEntriesByType(t: string): Array<{
            responseStart: number;
            domContentLoadedEventEnd: number;
            loadEventEnd: number;
            transferSize?: number;
          }>;
        };
        const n = perfApi.getEntriesByType('navigation')[0];
        if (!n) return {};
        return {
          navTtfb: Math.round(n.responseStart),
          domContentLoaded: Math.round(n.domContentLoadedEventEnd),
          load: Math.round(n.loadEventEnd),
          transferKB: Math.round((n.transferSize || 0) / 1024),
        };
      });
      const { metrics } = await cdp.send('Performance.getMetrics');
      const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
      const round = (n: number) => Math.round(n);
      return {
        lcp: vitals.lcp ?? null,
        cls: vitals.cls ?? null,
        inp: vitals.inp ?? null,
        ttfb: vitals.ttfb ?? nav.navTtfb ?? null,
        fcp: vitals.fcp ?? null,
        domContentLoaded: nav.domContentLoaded,
        load: nav.load,
        transferKB: nav.transferKB,
        scriptMs: round((m.ScriptDuration || 0) * 1000),
        layoutMs: round((m.LayoutDuration || 0) * 1000),
        recalcStyleMs: round((m.RecalcStyleDuration || 0) * 1000),
        taskMs: round((m.TaskDuration || 0) * 1000),
        jsHeapMB: Math.round(((m.JSHeapUsedSize || 0) / 1048576) * 10) / 10,
      };
    };

    const assertBudget = async (budget: PerfBudget = DEFAULT_BUDGET): Promise<PerfMetrics> => {
      const metrics = await collect();
      const violations = evaluateBudget(metrics, budget);

      await epic('Performance');
      await label('performance', violations.length ? 'over-budget' : 'within-budget');
      await attachment('performance-metrics', JSON.stringify(metrics, null, 2), 'application/json');
      writePerfRecord({ name: testInfo.title, url: page.url(), metrics, budget, violations });

      const summary = violations.map((v) => `${v.metric}=${v.value} > ${v.limit}`).join(', ');
      expect.soft(violations, `performance budget exceeded: ${summary}`).toEqual([]);
      return metrics;
    };

    await use({ collect, assertBudget });
    await cdp.detach();
  },
});
