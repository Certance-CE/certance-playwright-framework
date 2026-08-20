import { test as setup, expect, request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LoginPage } from '../pages/LoginPage';
import { fake } from '../utils/test-data';

/**
 * Authentication setup — runs once, before the suites that need a signed-in session.
 *
 * Every run provisions its OWN account through the API rather than sharing published
 * demo credentials. That is not tidiness: the shared accounts on this demo lock after
 * repeated failed attempts (verified — the API returns 423), so a suite built on them
 * goes red for reasons that have nothing to do with the code under test. An isolated
 * account per run cannot be locked by anyone else, and no credential ever enters the
 * repository.
 *
 * The signed-in state is saved as a storageState artefact, so no other test signs in
 * through the UI — golden rule #3.
 */
const AUTH_FILE = path.join(__dirname, '../test-data/.auth/toolshop.json');
const API_URL = process.env.APP_API_URL || 'https://api.practicesoftwaretesting.com';

/**
 * A password no breach corpus has seen. The service rejects anything it finds in one,
 * which is a good policy and makes a hard-coded fixture password impossible.
 */
function strongPassword(): string {
  return `Lx${crypto.randomBytes(12).toString('base64url')}!Qz9`;
}

setup('authenticate', async ({ page }) => {
  const email = fake.email('example.invalid'); // reserved TLD: unroutable by design
  const password = strongPassword();

  // ── provision the account over the API ────────────────────────────────────
  const api = await request.newContext({ baseURL: API_URL });
  const registration = await api.post('/users/register', {
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
  expect(
    registration.status(),
    `could not provision a test account (${registration.status()}): ${await registration.text()}`,
  ).toBe(201);
  await api.dispose();

  // ── sign in through the real UI, so this path is genuinely exercised ──────
  const loginPage = new LoginPage(page);
  await loginPage.login(email, password);
  await loginPage.expectSignedIn();

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
