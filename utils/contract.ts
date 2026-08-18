import { expect, type APIResponse } from '@playwright/test';
import type { ZodType } from 'zod';

/**
 * API contract validation (see skills/core/api.md).
 *
 * Wraps the `api` fixture's responses in runtime schema checks so a provider that
 * silently changes a field type, drops a field, or adds an unexpected enum value
 * FAILS the test with a precise, auditable message — turning the api fixture into
 * a provider-drift detector. Schemas are plain Zod, so they can be authored by
 * hand or generated from the provider's OpenAPI (e.g. openapi-zod-client).
 *
 * Two layers:
 *  - validateSchema(body, schema) — pure: validate an already-parsed value.
 *  - expectSchema(response, schema) — assert 2xx, parse JSON, then validateSchema.
 *
 * Both return the *typed* value on success, so the rest of the test is type-safe.
 */

function formatIssues(error: {
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string; code: string }>;
}): string {
  return error.issues
    .map((i) => `  · ${i.path.length ? i.path.join('.') : '(root)'} — ${i.message} [${i.code}]`)
    .join('\n');
}

/** Validate an already-parsed value against a Zod schema. Throws a drift error, returns typed data. */
export function validateSchema<T>(body: unknown, schema: ZodType<T>, label = 'response'): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`API contract drift — ${label} did not match its schema:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

/** Assert an APIResponse is 2xx and its JSON body matches the schema. Returns typed data. */
export async function expectSchema<T>(response: APIResponse, schema: ZodType<T>, label?: string): Promise<T> {
  const name = label ?? `${response.status()} ${response.url()}`;
  expect(response.ok(), `expected a 2xx response, got ${response.status()} for ${response.url()}`).toBeTruthy();

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`API contract drift — ${name} was not valid JSON`);
  }
  return validateSchema(body, schema, name);
}
