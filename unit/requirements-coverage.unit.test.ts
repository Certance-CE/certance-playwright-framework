import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * P0 — pin two defects in scripts/requirements-coverage.js and guard three
 * behaviours that are currently correct. Found 2026-09-06.
 *
 * The script produces the traceability matrix the README advertises as
 * "24/24 traced to a passing test". Today it will call a critical requirement
 * ✅ covered on a result that passed with no assertion behind it, and its gate
 * passes when a critical requirement's only scenario never ran (a @wip mute).
 * A coverage engine that can be greened by silencing a test is the exact
 * failure Certance is paid to find at clients — so it is pinned here first.
 *
 * TWO tests are RED on purpose (cases 1 and 2a): they are the specification for
 * the P1 fix. The script is deliberately NOT touched in this session — a fix
 * without a prior red test is a claim, not a proof. The tests drive the real
 * script through a child process, so what is pinned is the artefact CI runs.
 */

const SCRIPT = path.join(__dirname, '../scripts/requirements-coverage.js');

type Fixture = {
  requirements?: Record<string, string>; // filename -> markdown
  features?: Record<string, string>; // filename -> gherkin
  steps?: Record<string, string>; // filename -> step-definition TS
  pages?: Record<string, string>; // filename -> page-object TS
  results?: Record<string, unknown>[]; // allure result objects
  gate?: boolean; // REQ_FAIL_ON_GAP=1
};

/** Build a synthetic fixture set in a fresh temp dir and run the real script over it. */
function run(f: Fixture) {
  const root = mkdtempSync(path.join(tmpdir(), 'reqcov-'));
  const dir = (name: string, files: Record<string, string> = {}) => {
    const d = path.join(root, name);
    mkdirSync(d, { recursive: true });
    for (const [file, body] of Object.entries(files)) writeFileSync(path.join(d, file), body);
    return d;
  };
  const results = dir('allure-results');
  (f.results ?? []).forEach((r, i) => writeFileSync(path.join(results, `r${i}-result.json`), JSON.stringify(r)));
  const matrix = path.join(root, 'requirements-coverage.md');
  const proc = spawnSync('node', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REQ_DIR: dir('requirements', f.requirements),
      FEATURES_DIR: dir('features', f.features),
      STEPS_DIR: dir('steps', f.steps), // not read by the script yet — P1 must honour it
      PAGES_DIR: dir('pages', f.pages), // not read by the script yet — P1 must honour it
      ALLURE_RESULTS_DIR: results,
      REQ_MATRIX_OUT: matrix,
      REQ_FAIL_ON_GAP: f.gate ? '1' : '',
      GITHUB_STEP_SUMMARY: '',
    },
  });
  return { status: proc.status, stdout: proc.stdout, stderr: proc.stderr, matrix: readFileSync(matrix, 'utf8') };
}

// Shared fragments, so each case reads as a one-line difference from the last.

const REQ = `---
epic: Payments
journey: pay
priority: critical
---

# Payments

## REQ-PAY-001 — Fees are calculated correctly

**Priority:** critical
`;

const FEATURE = (tags = '@regression @req:REQ-PAY-001') => `@app @payments
Feature: Payments

  ${tags}
  Scenario: Fee is calculated correctly
    Given a payment
    When it is priced
    Then the fee is right
`;

const passed = (extra: Record<string, unknown> = {}) => ({
  uuid: 'r1',
  name: 'Fee is calculated correctly',
  status: 'passed',
  stage: 'finished',
  start: 1,
  stop: 2,
  labels: [{ name: 'tag', value: 'req:REQ-PAY-001' }],
  ...extra,
});

// Case 2a: three steps with empty bodies — the name promises a check the body never makes.
const STEPS_EMPTY = `import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('a payment', async () => {});
When('it is priced', async () => {});
Then('the fee is right', async () => {});
`;

// Case 2b: the Then step asserts, one hop away, through a Page Object method.
const STEPS_ASSERTING = `import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('a payment', async () => {});
When('it is priced', async () => {});
Then('the fee is right', async ({ payPage }) => {
  await payPage.expectFee();
});
`;

const PAGE_ASSERTING = `import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class PayPage extends BasePage {
  private fee = this.page.getByTestId('fee');

  async expectFee() {
    await expect(this.fee).toHaveText('1.00');
  }
}
`;

const req = { 'payments.md': REQ };

/** The matrix row for a requirement, or '' if absent. */
const row = (md: string, id: string) => md.split('\n').find((l) => l.includes(`\`${id}\``)) ?? '';

describe('requirements-coverage — coverage-engine defects and guards', () => {
  it('muted scenario cannot pass the gate', () => {
    // A @wip / muted scenario is excluded from the run, so it produces no result:
    // exactly this fixture (a scenario exists, nothing ran). A critical requirement
    // in that state must NOT pass the gate. RED today: the state is `pending`, which
    // the gate ignores, so the script exits 0.
    const { status, matrix } = run({ requirements: req, features: { 'payments.feature': FEATURE() }, gate: true });
    expect(status).toBe(1);
    expect(row(matrix, 'REQ-PAY-001')).not.toContain('covered');
  });

  it('a green result with no assertion is not coverage', () => {
    // The scenario passed, but its steps assert nothing. Present is not correct.
    // RED today: the script never inspects assertions, so the row says ✅ covered.
    const { matrix } = run({
      requirements: req,
      features: { 'payments.feature': FEATURE() },
      steps: { 'payments.steps.ts': STEPS_EMPTY },
      results: [passed()],
    });
    expect(row(matrix, 'REQ-PAY-001')).not.toContain('covered');
  });

  it('an assertion one hop away in a Page Object counts (positive control)', () => {
    // The assertion lives in a Page Object method the step calls — the golden-rules
    // way. This must still count, so P1's assertion floor does not punish good style.
    const { matrix } = run({
      requirements: req,
      features: { 'payments.feature': FEATURE() },
      steps: { 'payments.steps.ts': STEPS_ASSERTING },
      pages: { 'PayPage.ts': PAGE_ASSERTING },
      results: [passed()],
    });
    expect(row(matrix, 'REQ-PAY-001')).toMatch(/covered|asserted/);
  });

  it('a requirement with no scenario fails the gate', () => {
    // No scenario references the requirement (the tag is @regression, not @req:…),
    // and nothing ran — a genuine gap. A critical gap must fail the gate.
    const { status, matrix } = run({
      requirements: req,
      features: { 'payments.feature': FEATURE('@regression') },
      gate: true,
    });
    expect(status).toBe(1);
    expect(row(matrix, 'REQ-PAY-001')).toContain('gap');
  });

  it('a requirement covered only through an Allure label still counts', () => {
    // No .feature file mentions it; a plain spec reported req:REQ-PAY-001 and passed.
    // That is real coverage and the row must name the test that provides it.
    const { matrix } = run({ requirements: req, results: [passed()] });
    const r = row(matrix, 'REQ-PAY-001');
    expect(r).toContain('covered');
    expect(r).toContain('Fee is calculated correctly');
  });

  it('a skipped result is not coverage', () => {
    // The scenario was skipped, not asserted. A skip is not a pass.
    const { matrix } = run({
      requirements: req,
      features: { 'payments.feature': FEATURE() },
      results: [passed({ status: 'skipped' })],
    });
    expect(row(matrix, 'REQ-PAY-001')).not.toContain('covered');
  });
});
