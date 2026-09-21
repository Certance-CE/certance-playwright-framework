import { test, expect } from '@playwright/test';

/**
 * DEMONSTRATION — this PR is expected to be RED, and must never be merged.
 *
 * It plays out the exact failure the Governed Loop exists to prevent: a test was
 * failing because the application is genuinely broken, and instead of surfacing that,
 * the failing test was quietly muted with `test.fixme()` to make CI green. Nobody
 * signed off, because nobody was asked.
 *
 * The governed-skip gate (scripts/governed-skip-check.js) reads this PR's diff, sees a
 * newly muted test with no recorded reason, and FAILS the build. To mute it honestly you
 * would have to write the reason on the line — `// governed-skip: APP-123 …` — which puts
 * a human's name against the decision, in the open, where a reviewer sees it.
 */
test.fixme('checkout rejects an expired card', async () => {
  // The application is currently letting an expired card through — a real defect.
  // Muting the test hides it. The gate refuses to let that happen silently.
  expect('payment accepted').toBe('payment rejected');
});
