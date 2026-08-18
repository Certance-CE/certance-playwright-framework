/**
 * Environment configuration helper — centralises access to env vars
 * and throws clear errors if required values are missing.
 *
 * Usage:
 *   import { env } from '../utils/env';
 *   await page.goto(env.baseUrl);
 */

import { deobfuscate } from './obfuscation';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` + `Copy .env.example → .env and fill in all required values.`,
    );
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  /** Base URL of the application under test */
  get baseUrl(): string {
    return required('BASE_URL');
  },

  /** Credentials for the default test user */
  get testUserEmail(): string {
    return required('TEST_USER_EMAIL');
  },
  get testUserPassword(): string {
    return deobfuscate(required('TEST_USER_PASSWORD'));
  },

  /** Primary post-login URL (list, dashboard, etc.) */
  get appListUrl(): string {
    return optional('APP_LIST_URL', required('BASE_URL'));
  },

  /** true when running inside a CI environment */
  get isCI(): boolean {
    return process.env.CI === 'true';
  },
} as const;
