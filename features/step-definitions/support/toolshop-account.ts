import type { APIRequestContext } from '@playwright/test';
import crypto from 'node:crypto';

/**
 * Application-specific account provisioning for the reference app (client layer —
 * golden rule #12 keeps this out of the framework core).
 *
 * Every scenario that needs a sign-in creates its own account. The demo's published
 * shared accounts lock after repeated failed attempts (the API returns 423), so a
 * suite built on them fails for reasons unrelated to the code under test.
 */
export interface TestAccount {
  email: string;
  password: string;
}

/** A password no breach corpus has seen — the service rejects any that appear in one. */
export function strongPassword(): string {
  return `Lx${crypto.randomBytes(12).toString('base64url')}!Qz9`;
}

export async function registerAccount(api: APIRequestContext, email: string): Promise<TestAccount> {
  const password = strongPassword();
  const response = await api.post('/users/register', {
    data: {
      first_name: 'Certance',
      last_name: 'Lens',
      address: { street: '1 Test Street', city: 'Testville', state: 'TS', country: 'NL', postal_code: '1234AB' },
      phone: '0612345678',
      dob: '1990-01-01',
      email,
      password,
    },
  });
  if (response.status() !== 201) {
    throw new Error(`could not register a test account (HTTP ${response.status()}): ${await response.text()}`);
  }
  return { email, password };
}
