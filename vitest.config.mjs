import { defineConfig } from 'vitest/config';

/**
 * Vitest — a fast, browser-free unit-test layer for the framework's PURE logic
 * (validators, budget evaluation, dep-free helpers). This is what mutation
 * testing (StrykerJS) runs against; see stryker.config.mjs + skills/core/mutation.md.
 * Playwright still owns everything UI/E2E; vitest only touches `unit/`.
 */
export default defineConfig({
  test: {
    include: ['unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // Scoped to the pure, dependency-free modules that unit tests can honestly
      // reach. utils/performance.ts's budget logic is pure (its page script and file
      // I/O run in the @perf lane); utils/visual.ts needs a Page, so Playwright owns it.
      include: ['utils/contract.ts', 'utils/test-data.ts', 'utils/performance.ts'],
    },
  },
});
