/**
 * Fixture registry — composes all fixture modules and re-exports a single
 * `test` object for use in step definitions and spec files.
 *
 * Usage in step definitions:
 *   import { test } from '../../fixtures';
 *   const { Given, When, Then } = createBdd(test);
 *
 * Usage in spec files:
 *   import { test, expect } from '../fixtures';
 *   test('adds a todo', async ({ todoPage }) => { ... });
 *
 * Composition chain (each module .extend()s the previous):
 *   pages → allure → data → network → a11y → api → cleanup → perf
 * Every fixture a test needs (Page Objects, synthetic data, network mocking,
 * accessibility, API request context, cleanup disposers, performance) is reachable
 * from this one `test` object.
 */
import { test as composedTest } from './perf.fixture';

export const test = composedTest.extend<{ scenario: Map<string, unknown> }>({
  /**
   * Per-scenario scratch space for passing state between steps — a value created in a
   * Given and asserted in a Then. A generic mechanism with no application knowledge, so
   * the core stays app-agnostic (golden rule #12).
   */
  scenario: async ({}, use) => {
    await use(new Map<string, unknown>());
  },
});
export const { expect } = test;

// Re-export fixture types + helpers so specs/steps can import them from one place.
export type { TestData, RealisticData, EdgeData } from './data.fixture';
export type { A11yOptions, A11yResult } from './a11y.fixture';
export type { MockHandler, DegradeOptions } from './network.fixture';
export type { Cleanup } from './cleanup.fixture';
export type { Perf } from './perf.fixture';
export type { PerfMetrics, PerfBudget } from '../utils/performance';
