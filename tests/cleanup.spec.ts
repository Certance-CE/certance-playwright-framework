import { test, expect } from '../fixtures';

/**
 * Framework self-test for the `cleanup` fixture contract
 * (see fixtures/cleanup.fixture.ts). Fully offline — no app, no auth, no network.
 *
 * Serial mode: the first test deliberately fails and records what teardown did;
 * the second asserts on that record. Module-scoped state is shared because both
 * run in the same worker, in order.
 */
test.describe.configure({ mode: 'serial' });

/** What the disposers actually did, in the order they ran. */
const disposed: string[] = [];

test.describe('cleanup fixture — contract', () => {
  test('registers disposers and runs them even when the test fails', async ({ cleanup }) => {
    // This test is EXPECTED to fail — teardown must still run (contract rule 2).
    test.fail();

    cleanup.register('first', () => void disposed.push('first'));
    cleanup.register('throws', () => {
      disposed.push('throws');
      throw new Error('disposer blew up'); // contract rule 3 — must not block others
    });
    cleanup.register('last', () => void disposed.push('last'));

    expect(cleanup.size).toBe(3);

    // Deliberate failure.
    expect(1, 'deliberate failure to prove teardown still runs').toBe(2);
  });

  test('disposers ran LIFO, survived an error, and ran despite the failure', async () => {
    // Rule 2 — teardown ran at all, even though the test above failed.
    expect(disposed, 'teardown did not run for a failing test').toHaveLength(3);

    // Rule 1 — reverse (LIFO) registration order.
    expect(disposed).toEqual(['last', 'throws', 'first']);

    // Rule 3 — the throwing disposer did not stop 'first' from running.
    expect(disposed).toContain('first');
  });

  test('a test that registers nothing tears down cleanly', async ({ cleanup }) => {
    expect(cleanup.size).toBe(0); // no-op teardown, no warnings
  });
});
