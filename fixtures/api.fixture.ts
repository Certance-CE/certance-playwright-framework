import { test as a11yTest } from './a11y.fixture';
import { request, type APIRequestContext } from '@playwright/test';

/**
 * `api` fixture — an authenticated `APIRequestContext` for fast, deterministic
 * setup and verification via the app's HTTP API (see skills/core/api.md).
 *
 * Two main uses:
 *  - **Seed via API, assert via UI** — create the state a UI test needs through
 *    the API (far faster and less flaky than driving setup through the browser),
 *    then verify it in the page.
 *  - **Contract checks** — assert an endpoint's status and response shape.
 *
 * Config from env (see .env.example):
 *   APP_API_URL    base URL of the API (falls back to BASE_URL)
 *   APP_API_TOKEN  value for the Authorization header. Optional — without it the
 *                  context still works for public/unauthenticated endpoints.
 */
export const test = a11yTest.extend<{ api: APIRequestContext }>({
  api: async ({}, use) => {
    const baseURL = process.env.APP_API_URL || process.env.BASE_URL;
    const token = process.env.APP_API_TOKEN;
    const context = await request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
        ...(token ? { Authorization: token } : {}),
      },
    });
    await use(context);
    await context.dispose();
  },
});
