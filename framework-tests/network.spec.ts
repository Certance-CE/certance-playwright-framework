import { test, expect } from '../fixtures';

/**
 * Framework self-test for the `degrade` fault injector (fixtures/network.fixture.ts).
 * Fully offline — every fault is applied to a stubbed URL, no app/network needed.
 * Proves the app-facing behaviour a DORA graceful-degradation assertion relies on.
 *
 * Uses navigation responses (not locators) so it stays golden-rule-clean.
 */
test.describe('degrade — dependency fault injection', () => {
  test('injects an error status (503)', async ({ page, degrade }) => {
    await degrade('**/dependency', { status: 503 });
    const res = await page.goto('https://dep.test/dependency');
    expect(res?.status()).toBe(503);
  });

  test('injects latency before the response', async ({ page, degrade }) => {
    await degrade('**/slow', { delay: 400, status: 200, body: 'ok' });
    const start = Date.now();
    const res = await page.goto('https://dep.test/slow');
    expect(res?.status()).toBe(200);
    // The 400ms fault is observable (threshold well under it to avoid flake).
    expect(Date.now() - start).toBeGreaterThanOrEqual(300);
  });

  test('injects a hard connection failure', async ({ page, degrade }) => {
    await degrade('**/down', { abort: 'connectionrefused' });
    await expect(page.goto('https://dep.test/down')).rejects.toThrow();
  });

  test('leaves unrelated requests untouched', async ({ page, degrade, mock }) => {
    await degrade('**/dependency', { status: 500 });
    await mock('**/healthy', (route) => route.fulfill({ status: 200, body: 'fine' }));
    const res = await page.goto('https://dep.test/healthy');
    expect(res?.status()).toBe(200); // the degrade rule did not catch this URL
  });
});
