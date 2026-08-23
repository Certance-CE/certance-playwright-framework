import type { APIRequestContext } from '@playwright/test';
import crypto from 'node:crypto';

/**
 * Account provisioning for the demo application (client layer — golden rule #12 keeps
 * application knowledge out of the framework core).
 *
 * Each scenario creates its own account rather than sharing one. Shared accounts make
 * tests order-dependent and, on any shared environment, lockable by someone else.
 */
export interface DemoAccount {
  username: string;
  password: string;
}

export async function registerAccount(api: APIRequestContext, seed: string): Promise<DemoAccount> {
  const username = `lens${seed.replace(/\W/g, '').slice(0, 20).toLowerCase()}`;
  const password = `Lx${crypto.randomBytes(12).toString('base64url')}!Qz9`;
  const response = await api.post('/api/v1/register', {
    data: { username, email: `${username}@example.invalid`, password },
  });
  if (!response.ok()) {
    throw new Error(`could not register a demo account (HTTP ${response.status()}): ${await response.text()}`);
  }

  // A 200 is not proof the API answered. Single-page applications serve their shell for
  // unknown routes, so a mistyped path returns HTML with a success status and the account
  // is never created — the failure then surfaces much later as "wrong password", which is
  // a miserable thing to debug. Insist on the shape we asked for.
  const created = await response.json().catch(() => null);
  if (!created || typeof created !== 'object' || !('id' in created)) {
    throw new Error(
      `registration returned ${response.status()} but not a user object — check APP_API_URL ` +
        `(${response.url()}). Body began: ${(await response.text()).slice(0, 80)}`,
    );
  }
  return { username, password };
}

/**
 * Exchange credentials for a bearer token.
 *
 * The API lane needs a token, and the only honest way to get one is the endpoint a
 * real client would use. Asserting the shape rather than `response.ok()` for the same
 * reason registration does: a single-page application answers 200 with HTML for a
 * route it does not know, and a token of `undefined` fails later as a puzzling 401.
 */
export async function loginForToken(api: APIRequestContext, account: DemoAccount): Promise<string> {
  const response = await api.post('/api/v1/login', { data: account });
  if (!response.ok()) {
    throw new Error(`could not sign in as ${account.username} (HTTP ${response.status()}): ${await response.text()}`);
  }
  const body = await response.json().catch(() => null);
  if (!body || typeof body.token !== 'string' || body.token.length === 0) {
    throw new Error(`login returned ${response.status()} but no token — check APP_API_URL (${response.url()})`);
  }
  return body.token;
}
