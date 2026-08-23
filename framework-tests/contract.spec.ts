import { test, expect } from '../fixtures';
import { z } from 'zod';
import { validateSchema, expectSchema } from '../utils/contract';
import type { APIResponse } from '@playwright/test';

/**
 * Framework self-test for the API contract validators (utils/contract.ts).
 * Fully offline — no app, no auth, no network. Proves provider-drift is caught.
 */

const Task = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['todo', 'in-progress', 'done']),
});

test.describe('API contract validation', () => {
  test('validateSchema returns typed data for a conforming body', async () => {
    const data = validateSchema({ id: 'a1', name: 'Task', status: 'todo' }, Task);
    expect(data.status).toBe('todo'); // typed access, no cast
  });

  test('validateSchema throws a precise drift error naming the offending field', () => {
    // status carries an enum value the provider never announced.
    const act = () => validateSchema({ id: 'a1', name: 'Task', status: 'archived' }, Task, 'GET /task');
    expect(act).toThrow('API contract drift — GET /task');
    expect(act).toThrow(/status/); // the offending path is surfaced
  });

  test('validateSchema flags a dropped field and a wrong type', () => {
    // id is the wrong type and name is missing entirely.
    const act = () => validateSchema({ id: 42, status: 'todo' }, Task);
    expect(act).toThrow(/id/);
    expect(act).toThrow(/name/);
  });

  test('expectSchema validates an APIResponse-shaped value (offline stub)', async () => {
    // Minimal APIResponse stub — exercises the status + json + validate path with no network.
    const ok = {
      ok: () => true,
      status: () => 200,
      url: () => 'https://x/task',
      json: async () => ({ id: 'a1', name: 'T', status: 'done' }),
    } as unknown as APIResponse;
    const data = await expectSchema(ok, Task);
    expect(data.status).toBe('done');

    const notOk = {
      ok: () => false,
      status: () => 503,
      url: () => 'https://x/task',
      json: async () => ({}),
    } as unknown as APIResponse;
    await expect(expectSchema(notOk, Task)).rejects.toThrow(/2xx/);
  });
});
