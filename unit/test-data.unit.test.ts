import { describe, it, expect } from 'vitest';
import { fake } from '../utils/test-data';

/**
 * Unit tests for the synthetic-data factory.
 *
 * The property that matters is UNIQUENESS: every value the factory hands out is
 * used to create a record in a shared test account, so a collision means one test
 * asserts on another test's data. These tests pin that contract, and give the
 * mutation run (stryker.config.mjs) something real to mutate.
 */
describe('fake', () => {
  it('never returns the same value twice from the same generator', () => {
    const names = Array.from({ length: 50 }, () => fake.taskName());
    expect(new Set(names).size).toBe(50);
  });

  it('keeps values unique across different generators', () => {
    const mixed = [fake.taskName(), fake.projectName(), fake.comment(), fake.unique('X')];
    expect(new Set(mixed).size).toBe(mixed.length);
  });

  it('uses the supplied base label, and a sensible default without one', () => {
    expect(fake.taskName('Invoice')).toMatch(/^Invoice · /);
    expect(fake.taskName()).toMatch(/^Automated Task · /);
    expect(fake.projectName('Ledger')).toMatch(/^Ledger · /);
    expect(fake.projectName()).toMatch(/^Test Project · /);
    expect(fake.unique('Anything')).toMatch(/^Anything · /);
  });

  it('stamps every value with the run date so a leaked record is traceable', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(fake.taskName()).toContain(today);
    expect(fake.comment()).toContain(today);
  });

  it('pads the counter so names sort lexicographically in the order created', () => {
    const [a, b] = [fake.unique('S'), fake.unique('S')];
    const suffix = (s: string) => s.split(' · ').pop() as string;
    expect(suffix(a)).toMatch(/^\d{4}$/);
    expect(suffix(a) < suffix(b)).toBe(true);
  });

  it('only ever produces unroutable email addresses (never real PII)', () => {
    const address = fake.email();
    expect(address).toMatch(/@testmail\.invalid$/);
    expect(address).not.toBe(fake.email());
  });

  it('honours a custom email domain', () => {
    expect(fake.email('example.invalid')).toMatch(/@example\.invalid$/);
  });

  it('returns exactly N distinct names from taskNames', () => {
    const names = fake.taskNames(5);
    expect(names).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5']);
    expect(fake.taskNames(3, 'Row')).toEqual(['Row 1', 'Row 2', 'Row 3']);
    expect(fake.taskNames(0)).toEqual([]);
  });
});
