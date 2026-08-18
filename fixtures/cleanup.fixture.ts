import { test as apiTest } from './api.fixture';

/**
 * `cleanup` fixture — test-data teardown (skills/core/test-data.md §3 Option B).
 *
 * Any test that creates a persistent record registers how to remove it. The
 * fixture then disposes everything after the test, so a shared test account does
 * not accumulate junk run after run.
 *
 *   test('creates a record', async ({ data, cleanup, api }) => {
 *     const res = await api.post('/api/records', { data: { name: data.unique('rec') } });
 *     const { id } = await res.json();
 *     cleanup.register(`record ${id}`, () => api.delete(`/api/records/${id}`));
 *     ...
 *   });
 *
 * The disposer is just an async function, so teardown is **transport-agnostic** —
 * delete via the `api` fixture, or drive a Page Object, whichever the app supports.
 *
 * Contract (enforced by tests/cleanup.spec.ts):
 *  1. **LIFO order** — disposers run in reverse registration order, so a child
 *     created after its parent is removed first.
 *  2. **Always runs** — teardown happens even when the test fails, so a failing
 *     test does not leak data.
 *  3. **Error isolation** — one throwing disposer never prevents the others.
 *  4. **Never fails the test** — a cleanup problem is reported as an annotation +
 *     console warning, not a test failure. Cleanup noise must never mask, or
 *     invent, a pass/fail signal; leaked data is an operational issue, not a
 *     product defect.
 */

export interface Cleanup {
  /** Register how to remove something this test created. `label` appears in reports. */
  register(label: string, dispose: () => Promise<unknown> | unknown): void;
  /** How many disposers are currently registered (used by the self-tests). */
  readonly size: number;
}

interface Disposer {
  label: string;
  dispose: () => Promise<unknown> | unknown;
}

export const test = apiTest.extend<{ cleanup: Cleanup }>({
  cleanup: async ({}, use, testInfo) => {
    const disposers: Disposer[] = [];

    await use({
      register(label, dispose) {
        disposers.push({ label, dispose });
      },
      get size() {
        return disposers.length;
      },
    });

    // ── teardown ────────────────────────────────────────────────────────────
    // Reverse order; every disposer is attempted even if an earlier one threw.
    const failures: string[] = [];
    for (const { label, dispose } of [...disposers].reverse()) {
      try {
        await dispose();
      } catch (error) {
        failures.push(`${label}: ${(error as Error).message}`);
      }
    }

    if (failures.length > 0) {
      const summary = `${failures.length} of ${disposers.length} disposer(s) failed`;
      testInfo.annotations.push({ type: 'cleanup-failed', description: `${summary} — ${failures.join(' | ')}` });
      // Surfaced, never thrown — see contract rule 4.
      console.warn(`[cleanup] ${summary}:\n  ${failures.join('\n  ')}`);
    }
  },
});
