import { test as allureTest } from './allure.fixture';
import { faker } from '@faker-js/faker';
import { fake } from '../utils/test-data';

/**
 * `data` fixture — synthetic test data (golden rule #7).
 *
 * Hybrid provider with one interface, so a test never cares which backs it:
 *
 *  - `data.*`           dep-free core (utils/test-data.ts `fake`). **Always unique**
 *                       (date + counter), so it is safe for anything you create and
 *                       persist — no collisions across a run.
 *  - `data.realistic.*` faker. Human-plausible names/emails/prose for display and
 *                       readability. Reproducible when `FAKER_SEED` is set; note a
 *                       seeded run repeats values, so prefer `data.*` for created
 *                       entities that must be unique.
 *  - `data.edge.*`      boundary / stress inputs (long, unicode, emoji, whitespace)
 *                       and **input-hardening probes** (SQL/HTML-ish strings used to
 *                       verify the app *escapes* them — for defensive assertions,
 *                       never sent anywhere real).
 *
 * See skills/core/test-data.md for usage guidance.
 */

// Seed faker once per process when asked, so a run is reproducible in reports/CI.
if (process.env.FAKER_SEED) faker.seed(Number(process.env.FAKER_SEED));

export interface RealisticData {
  name(): string;
  email(): string;
  company(): string;
  jobTitle(): string;
  sentence(): string;
  paragraph(): string;
  url(): string;
}

export interface EdgeData {
  /** A string of `len` printable chars (default 256) — layout / max-length stress. */
  longName(len?: number): string;
  /** Mixed-script unicode — RTL, CJK, accents, symbols. */
  unicode(): string;
  /** Emoji-heavy string — grapheme handling. */
  emoji(): string;
  /** Leading/trailing/inner whitespace — trim behaviour. */
  whitespace(): string;
  /** SQL-injection-shaped probe — assert the app escapes/rejects it. */
  sqlish(): string;
  /** XSS-shaped probe — assert the app renders it inert (no script execution). */
  xssish(): string;
  /** Empty string — required-field validation. */
  empty(): string;
}

export interface TestData {
  // dep-free core (unique — safe for created entities)
  taskName(base?: string): string;
  projectName(base?: string): string;
  comment(): string;
  email(domain?: string): string;
  unique(label: string): string;
  taskNames(count: number, base?: string): string[];
  // richer providers
  realistic: RealisticData;
  edge: EdgeData;
}

const realistic: RealisticData = {
  name: () => faker.person.fullName(),
  email: () => faker.internet.email().toLowerCase(),
  company: () => faker.company.name(),
  jobTitle: () => faker.person.jobTitle(),
  sentence: () => faker.lorem.sentence(),
  paragraph: () => faker.lorem.paragraph(),
  url: () => faker.internet.url(),
};

const edge: EdgeData = {
  longName: (len = 256) => 'Lo·rem'.repeat(Math.ceil(len / 6)).slice(0, len),
  unicode: () => 'Ωμέγα · 日本語テスト · مرحبا · Ĥéllo Wörld · ✓',
  emoji: () => '🧪✅🚀🔥 test 😀 data 🌍',
  whitespace: () => '   leading and trailing   ',
  sqlish: () => "'; DROP TABLE tasks;--",
  xssish: () => '<script>alert(1)</script>',
  empty: () => '',
};

export const test = allureTest.extend<{ data: TestData }>({
  data: async ({}, use) => {
    const data: TestData = {
      taskName: (b) => fake.taskName(b),
      projectName: (b) => fake.projectName(b),
      comment: () => fake.comment(),
      email: (d) => fake.email(d),
      unique: (l) => fake.unique(l),
      taskNames: (n, b) => fake.taskNames(n, b),
      realistic,
      edge,
    };
    await use(data);
  },
});
