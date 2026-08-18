import { test as dataTest } from './data.fixture';
import type { Page, Route, Request } from '@playwright/test';

/**
 * Network mocking + fault-injection fixture (golden rule #6 — mock external
 * dependencies; DORA — prove graceful degradation of a failing dependency).
 *
 * Three things:
 *  - `mockThirdParties` (option, default **true**): aborts requests to known
 *    analytics / telemetry / session-replay / ads hosts, so UI tests are
 *    deterministic, faster, and never leak to third parties. Turn off per-test
 *    with `test.use({ mockThirdParties: false })`.
 *  - `mock(pattern, handler)`: a thin wrapper over `page.route` for per-test stubs
 *    of *your own* endpoints (fulfil, modify, or abort).
 *  - `degrade(pattern, opts)`: inject a fault — latency, an error status
 *    (429 / 5xx), or a hard connection failure — so a test can assert the app
 *    survives a slow / rate-limited / down dependency rather than only a missing one.
 *
 * See skills/core/mocking.md for guidance.
 */

// Non-essential third-party hosts blocked by default. Extend per engagement.
export const THIRD_PARTY_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'g.doubleclick.net',
  'doubleclick.net',
  'segment.io',
  'segment.com',
  'cdn.segment.com',
  'sentry.io',
  'ingest.sentry.io',
  'fullstory.com',
  'hotjar.com',
  'hotjar.io',
  'intercom.io',
  'intercomcdn.com',
  'mixpanel.com',
  'amplitude.com',
  'api.amplitude.com',
  'datadoghq.com',
  'browser-intake-datadoghq.com',
  'facebook.net',
  'connect.facebook.net',
  'clarity.ms',
  'logrocket.com',
  'logrocket.io',
  'launchdarkly.com',
  'events.launchdarkly.com',
];

function isThirdParty(hostname: string): boolean {
  return THIRD_PARTY_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h) || hostname.endsWith(h));
}

export type MockHandler = (route: Route, request: Request) => unknown;

/** How to degrade a dependency. Combine `delay` with `status` for a slow error. */
export interface DegradeOptions {
  /** Added latency in ms before the response (or before the failure). */
  delay?: number;
  /** Respond with this HTTP status (e.g. 429, 500, 503) instead of the real one. */
  status?: number;
  /** Body for the degraded response (default: a small JSON error). */
  body?: string;
  /** Hard connection failure instead of a status — a Playwright error code, e.g.
   *  'timedout', 'connectionrefused', 'connectionreset', 'failed'. Overrides `status`. */
  abort?: 'timedout' | 'connectionrefused' | 'connectionreset' | 'connectionaborted' | 'failed';
}

export const test = dataTest.extend<{
  mockThirdParties: boolean;
  mock: (pattern: string | RegExp, handler: MockHandler) => Promise<void>;
  degrade: (pattern: string | RegExp, opts?: DegradeOptions) => Promise<void>;
}>({
  // Option — flip with test.use({ mockThirdParties: false }).
  mockThirdParties: [true, { option: true }],

  // Per-test stub helper for your own endpoints.
  mock: async ({ page }, use) => {
    await use(async (pattern, handler) => {
      await page.route(pattern, handler);
    });
  },

  // Fault injection — latency / error status / connection failure.
  degrade: async ({ page }, use) => {
    await use(async (pattern, opts = {}) => {
      await page.route(pattern, async (route: Route) => {
        if (opts.delay) {
          await new Promise((resolve) => setTimeout(resolve, opts.delay));
        }
        if (opts.abort) {
          return route.abort(opts.abort);
        }
        if (opts.status) {
          return route.fulfill({
            status: opts.status,
            contentType: 'application/json',
            body: opts.body ?? JSON.stringify({ error: `degraded (${opts.status})` }),
          });
        }
        // delay-only: let the real response through, just slower.
        return route.continue();
      });
    });
  },

  // Override `page` to install the third-party blocker before the test runs.
  page: async ({ page, mockThirdParties }, use) => {
    if (mockThirdParties) {
      // URL-predicate route only intercepts matching hosts; everything else is untouched.
      await page.route(
        (url: URL) => isThirdParty(url.hostname),
        (route: Route) => route.abort(),
      );
    }
    await use(page as Page);
  },
});
