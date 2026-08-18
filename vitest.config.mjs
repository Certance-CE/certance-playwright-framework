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
  },
});
