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
