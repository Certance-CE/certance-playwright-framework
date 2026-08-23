import { test as a11yTest } from './a11y.fixture';
import { request, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

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
 *   APP_API_TOKEN  full value for the Authorization header, e.g. `Bearer eyJ…`.
 *                  Optional — without it the context still works for public
 *                  endpoints.
 *
 * When no `APP_API_TOKEN` is set, the fixture falls back to the token the setup
 * project published (below). That is what lets a cold `npm test` exercise the
 * API against a freshly provisioned account with nothing in `.env`.
 */

/** Where the setup project publishes the session it provisioned. */
const ACCOUNT_FILE = path.join(__dirname, '../test-data/.auth/account.json');

/**
 * The Authorization header value, or undefined for an anonymous context.
 *
 * `APP_API_TOKEN` wins so that pointing the suite at your own environment never
 * has to fight an artefact left behind by a previous demo run.
 */
function authorizationHeader(): string | undefined {
  if (process.env.APP_API_TOKEN) return process.env.APP_API_TOKEN;
  try {
    const { apiToken } = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    return typeof apiToken === 'string' && apiToken ? `Bearer ${apiToken}` : undefined;
  } catch {
    return undefined; // no setup artefact — an anonymous context is a valid state
  }
}

export const test = a11yTest.extend<{ api: APIRequestContext }>({
  api: async ({}, use) => {
    const baseURL = process.env.APP_API_URL || process.env.BASE_URL;
    const authorization = authorizationHeader();
    const context = await request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    await use(context);
    await context.dispose();
  },
});
