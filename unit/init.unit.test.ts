import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint } from 'eslint';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * `npm run init` (scripts/init.js) writes a customer's first Page Object, feature and
 * lanes. Code a framework generates is code it vouches for, so these tests hold the
 * scaffold to the same rules as anything a person writes: it must pass this repo's
 * golden-rule lint, carry its @req: traceability, and record why it removed the
 * reference target's tests. The browser probe is exercised by the rehearsal in the PR;
 * what is pinned here is everything that decides what lands in the customer's repo.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const init = require(path.join(__dirname, '../scripts/init.js'));

const LOGIN = {
  path: '/login',
  username: "getByRole('textbox', { name: 'Username', exact: true })",
  password: "getByLabel('Password', { exact: true })",
  submit: "getByRole('button', { name: 'Log in', exact: true })",
  unresolved: [],
};
const withLogin = init.scaffold({ url: 'https://app.example.test', name: 'Payments portal', login: LOGIN });
const noLogin = init.scaffold({ url: 'https://app.example.test', name: 'Docs site', title: "Docs — it's here" });

let eslint: ESLint;
// The first lintText() pays ESLint's cold start; see golden-rules.unit.test.ts.
beforeAll(async () => {
  eslint = new ESLint();
  await eslint.lintText('', { filePath: 'pages/Warm.ts' });
}, 60_000);

async function lintErrors(files: Record<string, string>) {
  const errors: string[] = [];
  for (const [file, code] of Object.entries(files)) {
    if (!file.endsWith('.ts')) continue;
    const [result] = await eslint.lintText(code, { filePath: file });
    for (const m of result?.messages ?? []) if (m.severity === 2) errors.push(`${file}: ${m.ruleId} ${m.message}`);
  }
  return errors;
}

describe('npm run init — the scaffold it writes', () => {
  it('passes the golden-rule lint, for an app with a sign-in form', async () => {
    expect(await lintErrors(withLogin)).toEqual([]);
  });

  it('passes the golden-rule lint, for an app without one', async () => {
    expect(await lintErrors(noLogin)).toEqual([]);
  });

  it('uses the locators the probe verified, verbatim', () => {
    const page = withLogin['pages/LoginPage.ts'];
    expect(page).toContain(`this.page.${LOGIN.username}`);
    expect(page).toContain(`this.page.${LOGIN.password}`);
    expect(page).toContain(`this.page.${LOGIN.submit}`);
    expect(page).toContain("this.goto('/login')");
  });

  it('marks a control with no rule-abiding locator as a TODO, never a CSS selector', () => {
    const files = init.scaffold({
      url: 'https://app.example.test',
      name: 'Legacy',
      login: { ...LOGIN, submit: null, unresolved: [{ key: 'submit', info: {} }] },
    });
    const page = files['pages/LoginPage.ts'];
    expect(page).toContain("getByTestId('TODO-submit')");
    expect(page).toMatch(/submit: no accessible name and no data-testid/);
    expect(page).not.toMatch(/locator\(/);
  });

  it('ties every generated scenario to a generated requirement', () => {
    for (const files of [withLogin, noLogin]) {
      const tags = [...files['features/smoke.feature'].matchAll(/@req:(REQ-[A-Z]+-\d+)/g)].map((m) => m[1]);
      expect(tags.length).toBeGreaterThan(0);
      for (const id of tags) expect(files['requirements/SMOKE.md']).toContain(`## ${id} —`);
    }
  });

  it('measures page performance from the first run, with the core performance step', () => {
    for (const files of [withLogin, noLogin]) {
      expect(files['features/smoke.feature']).toMatch(
        /@perf .*@req:REQ-SMOKE-00\d\n.*\n.*\n\s+Then the page meets its performance budget/,
      );
    }
  });

  it('keeps the signed-in lanes out until a test account is configured', () => {
    const config = withLogin['app.config.ts'];
    expect(config).toContain('process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD');
    expect(config).toMatch(/grepInvert: signedIn \? undefined : \/@credentials\//);
    expect(withLogin['features/smoke.feature']).toMatch(/@credentials @req:REQ-SMOKE-002/);
  });

  it('records why the reference tests are removed, so the integrity gate passes the first PR', () => {
    expect(withLogin['app.config.ts']).toMatch(/^\/\/ governed-change: /);
    expect(noLogin['app.config.ts']).toMatch(/^\/\/ governed-change: /);
  });

  it('escapes what it found on the page before writing it into TypeScript', () => {
    expect(noLogin['pages/HomePage.ts']).toContain("toHaveTitle('Docs — it\\'s here')");
  });

  it('reads its options', () => {
    expect(init.parseArgs(['--url', 'https://a.test', '--login'])).toMatchObject({ url: 'https://a.test', login: '/' });
    expect(init.parseArgs(['--url', 'https://a.test', '--login', '/signin', '--no-run'])).toMatchObject({
      login: '/signin',
      run: false,
    });
    expect(() => init.parseArgs(['--colour'])).toThrow(/unknown option/);
  });
});

describe('npm run init --api — the API lane it writes', () => {
  const JSON_API = {
    origin: 'https://api.example.test',
    path: '/api/v1/info',
    status: 200,
    contentType: 'application/json',
    json: { version: 'v2.5.0', 'link-sharing': true, motd: null, auth: { local: { enabled: true } }, tags: [] },
  };
  const TEXT_API = { origin: 'https://api.example.test', path: '/health', status: 200, contentType: 'text/plain' };
  const withApi = init.scaffold({
    url: 'https://app.example.test',
    name: 'Payments portal',
    login: LOGIN,
    api: JSON_API,
  });
  const textApi = init.scaffold({ url: 'https://app.example.test', name: 'Docs site', title: 'Docs', api: TEXT_API });
  const spec = (files: Record<string, string>, area: string) => files[`tests/api/${area}.api.spec.ts`];

  it('passes the golden-rule lint, for a JSON contract and for a status-only check', async () => {
    expect(await lintErrors(withApi)).toEqual([]);
    expect(await lintErrors(textApi)).toEqual([]);
  });

  it('asserts the types the API returned, never its values', () => {
    const src = init.schemaFor(JSON_API.json);
    expect(src).toContain('version: z.string()');
    expect(src).not.toContain('v2.5.0');
    expect(src).toContain("'link-sharing': z.boolean()"); // not an identifier, so quoted
    expect(src).toContain('motd: z.unknown()'); // one null says nothing about the type
    expect(src).toContain('tags: z.array(z.unknown())');
  });

  it('caps the contract at twelve fields and says so, rather than asserting everything', () => {
    const wide = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`f${i}`, i]));
    const src = init.schemaFor(wide);
    expect(src.match(/: z\.number\(\)/g)).toHaveLength(12);
    expect(src).toContain('3 more field(s) not asserted');
  });

  it('checks the status and content type when the endpoint is not JSON', () => {
    const src = spec(textApi, 'docs-site');
    expect(src).toContain('expect(response.status()).toBe(200)');
    expect(src).toContain("toContain('text/plain')");
    expect(src).not.toContain('expectSchema');
  });

  it('adds an api lane and points the api fixture at the API, overridable by APP_API_URL', () => {
    const config = withApi['app.config.ts'];
    expect(config).toContain("const API = process.env.APP_API_URL || 'https://api.example.test'");
    expect(config).toMatch(/name: 'api',\s+testDir: '\.\/tests\/api'/);
  });

  it('ties the API test to a requirement in the matrix', () => {
    expect(spec(withApi, 'payments-portal')).toContain("'@req:REQ-API-001'");
    expect(withApi['requirements/API.md']).toContain('## REQ-API-001 —');
  });

  it('escapes the app name safely in the generated test, backslashes included', async () => {
    const files = init.scaffold({ url: 'https://a.test', name: "Ops\\Payments 'EU'", title: 'T', api: TEXT_API });
    expect(spec(files, 'ops-payments-eu')).toContain("test.describe('Ops\\\\Payments \\'EU\\' — API'");
    expect(await lintErrors(files)).toEqual([]);
  });

  it('writes no API lane when --api is not given', () => {
    expect(Object.keys(withLogin).some((f) => f.startsWith('tests/api/'))).toBe(false);
    expect(withLogin['app.config.ts']).not.toContain("name: 'api'");
  });
});

describe('scripts/demo-layer.json — the boundary init cuts along', () => {
  // The application-specific directories. Anything tracked here belongs to the reference
  // target, and init must remove or replace it, or it survives into a customer's repo
  // and breaks their first run. The core files that legitimately live here are named.
  const CORE = new Set([
    'pages/BasePage.ts',
    'requirements/README.md',
    'features/step-definitions/performance.steps.ts',
  ]);
  const manifest = JSON.parse(readFileSync(path.join(__dirname, '../scripts/demo-layer.json'), 'utf8'));
  const owned = (f: string) =>
    [...manifest.remove, ...manifest.replace].some((m: string) => (m.endsWith('/') ? f.startsWith(m) : f === m));

  it('lists every reference-target file in pages/, features/, tests/ and requirements/', () => {
    const tracked = execFileSync('git', ['ls-files', 'pages', 'features', 'tests', 'requirements'], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    expect(tracked.length).toBeGreaterThan(0);
    expect(tracked.filter((f) => !CORE.has(f) && !owned(f))).toEqual([]);
  });

  it('never lists a core file', () => {
    for (const f of CORE) expect(owned(f)).toBe(false);
    for (const core of [
      'playwright.config.ts',
      'fixtures/index.ts',
      'utils/',
      'scripts/init.js',
      'scripts/demo-layer.json',
    ]) {
      expect(owned(core)).toBe(false);
    }
  });
});
