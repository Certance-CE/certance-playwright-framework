// @ts-check
/**
 * StrykerJS — mutation testing. Proves the unit tests actually CATCH bugs by
 * injecting deliberate defects ("mutants") into the source and checking the tests
 * fail. The mutation score (% of mutants killed) is a far stronger signal than
 * line coverage — it answers "would these tests notice a regression?", which
 * matters most for AI-generated tests. See skills/core/mutation.md.
 *
 * Scope: the framework's safety-critical PURE logic. Extend `mutate` as more
 * pure modules gain unit tests.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: ['utils/contract.ts'],
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  // CI gate: break the build if the mutation score drops below 70%.
  thresholds: { high: 90, low: 75, break: 70 },
};
