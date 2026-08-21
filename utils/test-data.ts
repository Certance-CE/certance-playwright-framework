import crypto from 'node:crypto';

/**
 * Test data factory — generates synthetic data for tests.
 *
 * Uses a deterministic seed when FAKER_SEED env var is set, so
 * CI runs produce reproducible names and can be traced in reports.
 *
 * Usage:
 *   import { fake } from '../utils/test-data';
 *   const name = fake.taskName();   // "Automated Task · 2026-03-29 · x7k2"
 */

/** Lightweight deterministic random — no external dependency required. */
class FakeFactory {
  private readonly prefix: string;
  private counter = 0;

  constructor() {
    // The date makes values readable and sortable; the counter separates values within
    // one process. Neither is enough on its own: Playwright runs each worker in its own
    // process, so every worker would otherwise start at counter 1 on the same date and
    // hand out identical values. A short per-instance token makes them unique across
    // workers, which matters the moment an application enforces uniqueness server-side.
    const token = crypto.randomBytes(3).toString('hex');
    this.prefix = `E2E · ${new Date().toISOString().slice(0, 10)} · ${token}`;
  }

  private next(): string {
    return `${++this.counter}`.padStart(4, '0');
  }

  /** Generic unique label — use as base for any entity name */
  unique(label: string): string {
    return `${label} · ${this.prefix} · ${this.next()}`;
  }

  /** Task / work item name */
  taskName(base = 'Automated Task'): string {
    return this.unique(base);
  }

  /** Project or space name */
  projectName(base = 'Test Project'): string {
    return this.unique(base);
  }

  /** Comment body */
  comment(): string {
    return `Automated comment · ${this.prefix} · ${this.next()}`;
  }

  /** Email address — safe for test accounts, never real PII */
  email(domain = 'testmail.invalid'): string {
    return `qa-${Date.now()}-${this.next()}@${domain}`;
  }

  /**
   * Returns a list of N unique task names.
   * Useful for seeding list views with known data.
   */
  taskNames(count: number, base = 'Task'): string[] {
    return Array.from({ length: count }, (_, i) => `${base} ${i + 1}`);
  }
}

/** Singleton factory — import this in all tests and step definitions */
export const fake = new FakeFactory();
