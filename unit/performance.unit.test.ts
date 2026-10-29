import { describe, it, expect } from 'vitest';
import { evaluateBudget, parseBudget, DEFAULT_BUDGET, PERF_METRICS } from '../utils/performance';

/**
 * The budget logic behind `Then the page meets … performance budget`. A budget check that
 * cannot fail, or that quietly ignores a limit, reports green on a slow page, so these pin
 * both directions: every breach is reported, and nothing a reader wrote is silently dropped.
 */
describe('evaluateBudget', () => {
  it('reports every metric over its limit, with the value and the limit', () => {
    const v = evaluateBudget({ lcp: 3000, cls: 0.2, ttfb: 100 }, { lcp: 2500, cls: 0.1, ttfb: 800 });
    expect(v).toEqual([
      { metric: 'lcp', value: 3000, limit: 2500 },
      { metric: 'cls', value: 0.2, limit: 0.1 },
    ]);
  });

  it('treats a value exactly at the limit as within budget', () => {
    expect(evaluateBudget({ lcp: 2500 }, { lcp: 2500 })).toEqual([]);
  });

  it('does not fail INP when the page had no interaction to measure', () => {
    expect(evaluateBudget({ lcp: 100, inp: null }, { lcp: 2500, inp: 200 })).toEqual([]);
  });

  it('fails a budgeted metric the page never produced, instead of passing it unseen', () => {
    expect(evaluateBudget({ lcp: null, cls: 0 }, { lcp: 2500, cls: 0.1 })).toEqual([
      { metric: 'lcp', value: null, limit: 2500 },
    ]);
    expect(evaluateBudget({}, { ttfb: 800 })).toEqual([{ metric: 'ttfb', value: null, limit: 800 }]);
  });

  it('does not check a metric whose limit is null (how a JSON budget switches one off)', () => {
    expect(evaluateBudget({ lcp: 9000 }, { lcp: null as unknown as number })).toEqual([]);
  });

  it('defaults to the Core Web Vitals "good" thresholds', () => {
    expect(DEFAULT_BUDGET).toMatchObject({ lcp: 2500, cls: 0.1, inp: 200, ttfb: 800 });
    const measured = { lcp: 2501, cls: 0, ttfb: 1, scriptMs: 1 };
    expect(evaluateBudget(measured)).toEqual([{ metric: 'lcp', value: 2501, limit: 2500 }]);
  });
});

describe('parseBudget — a budget written as a Gherkin table', () => {
  it('reads name/limit rows into a budget', () => {
    expect(
      parseBudget([
        ['lcp', '1500'],
        [' cls ', ' 0.05 '],
      ]),
    ).toEqual({ lcp: 1500, cls: 0.05 });
  });

  it('rejects a misspelt metric instead of checking it against nothing, and lists the real ones', () => {
    expect(() => parseBudget([['lpc', '1500']])).toThrow(
      /unknown performance metric "lpc" — use one of: lcp, cls, inp/,
    );
  });

  it('rejects a limit that is not a number', () => {
    expect(() => parseBudget([['lcp', 'fast']])).toThrow(/budget for lcp is not a number/);
    expect(() => parseBudget([['lcp', '']])).toThrow(/not a number/);
    // A blank cell: Number('  ') is 0, which would silently become a zero budget.
    expect(() => parseBudget([['lcp', '  ']])).toThrow(/not a number/);
  });

  it('accepts every metric the fixture measures, and only those', () => {
    const measured = [
      'lcp',
      'cls',
      'inp',
      'ttfb',
      'fcp',
      'domContentLoaded',
      'load',
      'transferKB',
      'scriptMs',
      'layoutMs',
      'recalcStyleMs',
      'taskMs',
      'jsHeapMB',
    ];
    expect([...PERF_METRICS]).toEqual(measured);
    expect(Object.keys(parseBudget(measured.map((m) => [m, '1'])))).toEqual(measured);
  });
});
