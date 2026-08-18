import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateSchema, expectSchema } from '../utils/contract';

/**
 * Fast, browser-free unit tests for the API contract validators
 * (utils/contract.ts). These are the tests StrykerJS mutates against — every
 * assertion here has to be strong enough to KILL a mutant (a deliberately
 * introduced bug), which is exactly what proves they catch real drift.
 */
const Task = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['todo', 'in-progress', 'done']),
});

describe('validateSchema', () => {
  it('returns the typed value for a conforming body', () => {
    const data = validateSchema({ id: 'a1', name: 'Task', status: 'todo' }, Task);
    expect(data).toEqual({ id: 'a1', name: 'Task', status: 'todo' });
    expect(data.status).toBe('todo');
  });

  it('throws a drift error that names the label and the offending field', () => {
    const act = () => validateSchema({ id: 'a1', name: 'Task', status: 'archived' }, Task, 'GET /task');
    expect(act).toThrow('API contract drift');
    expect(act).toThrow('GET /task');
    expect(act).toThrow(/status/);
  });

  it('flags a dropped field and a wrong type together', () => {
    const act = () => validateSchema({ id: 42, status: 'todo' }, Task);
    expect(act).toThrow(/id/);
    expect(act).toThrow(/name/);
  });

  it('defaults the label to "response" when none is given', () => {
    const act = () => validateSchema({}, Task);
    expect(act).toThrow(/response did not match/);
  });

  it('marks a root-level error as "(root)" rather than a field path', () => {
    // A non-object body fails at the root — no field path.
    const act = () => validateSchema('not an object', Task);
    expect(act).toThrow(/\(root\)/);
  });
});

describe('expectSchema', () => {
  const stub = (over: Partial<{ ok: boolean; status: number; body: unknown }>) =>
    ({
      ok: () => over.ok ?? true,
      status: () => over.status ?? 200,
      url: () => 'https://x/task',
      json: async () => over.body ?? {},
    }) as unknown as Parameters<typeof expectSchema>[0];

  it('returns typed data for a 2xx response that conforms', async () => {
    const data = await expectSchema(stub({ body: { id: 'a1', name: 'T', status: 'done' } }), Task);
    expect(data.status).toBe('done');
  });

  it('rejects a non-2xx response mentioning the status', async () => {
    await expect(expectSchema(stub({ ok: false, status: 503 }), Task)).rejects.toThrow(/2xx/);
  });

  it('rejects a 2xx response whose body drifts from the schema', async () => {
    await expect(expectSchema(stub({ body: { id: 1 } }), Task)).rejects.toThrow(/contract drift/);
  });

  it('defaults the drift label to "<status> <url>" when none is given', async () => {
    // No label passed → the error must carry the response's status + url.
    await expect(expectSchema(stub({ body: { id: 1 } }), Task)).rejects.toThrow(/200 https:\/\/x\/task/);
  });

  it('rejects when the body is not valid JSON', async () => {
    const badJson = {
      ok: () => true,
      status: () => 200,
      url: () => 'https://x/task',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Parameters<typeof expectSchema>[0];
    await expect(expectSchema(badJson, Task)).rejects.toThrow(/not valid JSON/);
  });
});
