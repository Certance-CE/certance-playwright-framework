import { test, expect } from '../fixtures';

/**
 * Framework foundation — a runnable reference for the data / mocking / a11y
 * fixtures. Fully offline: every page is served by a `mock()` stub, so this spec
 * needs no app, no auth, and no network. Run it with:
 *
 *   npm run test:examples
 *
 * It doubles as the verification that golden rules #6 (mock) and #7 (data) are
 * real, and that accessibility scanning is wired.
 */
test.describe('Framework foundation — data, mocking, accessibility', () => {
  test('data: dep-free core is unique; realistic + edge providers work', async ({ data }) => {
    // Core is always unique — safe for entities you create and persist.
    expect(data.taskName()).not.toBe(data.taskName());
    // Realistic (faker) — human-plausible display values.
    expect(data.realistic.name().length).toBeGreaterThan(0);
    expect(data.realistic.email()).toContain('@');
    // Edge / stress + input-hardening probes.
    expect(data.edge.longName(256)).toHaveLength(256);
    expect(data.edge.xssish()).toContain('<script>');
  });

  test('mocking: per-test stub fulfils; third-party hosts are blocked', async ({ page, mock }) => {
    const failed: string[] = [];
    page.on('requestfailed', (r) => failed.push(r.url()));

    await mock('**/foundation-demo', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><title>Demo</title></head>
          <body><main><h1>Mocked page</h1>
          <img alt="pixel" src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=">
          <img alt="tracker" src="https://www.google-analytics.com/collect?v=1"></main></body></html>`,
      }),
    );

    await page.goto('https://example.test/foundation-demo');
    // The stub served our HTML — no real server involved.
    await expect(page.getByRole('heading', { name: 'Mocked page' })).toBeVisible();
    // The third-party analytics beacon was aborted by mockThirdParties (web-first poll, no sleep).
    await expect.poll(() => failed.some((u) => u.includes('google-analytics'))).toBe(true);
  });

  test('accessibility: axe detects violations and attaches a report', async ({ page, mock, checkA11y }) => {
    await mock('**/a11y-demo', (route) =>
      route.fulfill({
        contentType: 'text/html',
        // Deliberately inaccessible: no lang, image with no alt, an empty button.
        body: `<!doctype html><html><head><title>A11y demo</title></head>
          <body><img src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=">
          <button></button></body></html>`,
      }),
    );
    await page.goto('https://example.test/a11y-demo');

    // failOn:false — we planted the violations on purpose; assert the scanner finds them.
    const { violations } = await checkA11y({ failOn: false });
    expect(violations.length).toBeGreaterThan(0);
  });
});
