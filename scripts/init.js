#!/usr/bin/env node
/**
 * `npm run init` — point the framework at your application.
 *
 *   npm run init -- --url https://staging.your-app.com
 *   npm run init -- --url https://staging.your-app.com --login /sign-in --name "Payments portal"
 *
 * It replaces the reference target (scripts/demo-layer.json: the Vikunja and TodoMVC
 * pages, features, requirements and lanes) with a scaffold for yours, and leaves the
 * framework core untouched. What you get is green on the first run and needs no
 * credentials:
 *
 *   - app.config.ts      your URL and lanes
 *   - a Page Object      for the landing page, or for the sign-in form with --login
 *   - a smoke feature    tagged @smoke and @req:, so traceability works from minute one
 *   - a requirement      requirements/SMOKE.md, which the coverage matrix reads
 *
 * With --login it opens the sign-in page (without signing in) and reads the form, so the
 * generated LoginPage uses locators verified against your real DOM, in golden-rule order:
 * role, then label, then placeholder, then test id. A field that has none of those is
 * reported, not papered over with CSS. The signed-in lanes switch on by themselves once
 * TEST_USER_EMAIL and TEST_USER_PASSWORD are set; until then they are left out rather
 * than failing, and the coverage matrix shows the sign-in requirement as not yet covered.
 *
 * Refuses to run twice (the demo layer is gone), unless --force.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(__dirname, 'demo-layer.json');

// ── Arguments ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { run: true, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--url') opts.url = next();
    else if (a === '--login') opts.login = argv[i + 1] && !argv[i + 1].startsWith('--') ? next() : '/';
    else if (a === '--name') opts.name = next();
    else if (a === '--no-run') opts.run = false;
    else if (a === '--force') opts.force = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

// ── Probe: read the application, never sign in ──────────────────────────────

/** Escape a string for a single-quoted TypeScript literal. */
const lit = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * Locator candidates for one element, strongest first (golden rule #1). Each is the
 * TypeScript a Page Object would contain, plus how to build it here to verify it.
 */
function candidates(info) {
  const out = [];
  if (info.role && info.name) {
    out.push({
      code: `getByRole(${lit(info.role)}, { name: ${lit(info.name)}, exact: true })`,
      make: (p) => p.getByRole(info.role, { name: info.name, exact: true }),
    });
  }
  if (info.label) {
    out.push({
      code: `getByLabel(${lit(info.label)}, { exact: true })`,
      make: (p) => p.getByLabel(info.label, { exact: true }),
    });
  }
  if (info.placeholder) {
    out.push({
      code: `getByPlaceholder(${lit(info.placeholder)}, { exact: true })`,
      make: (p) => p.getByPlaceholder(info.placeholder, { exact: true }),
    });
  }
  if (info.testId) out.push({ code: `getByTestId(${lit(info.testId)})`, make: (p) => p.getByTestId(info.testId) });
  return out;
}

/** The first candidate that resolves to exactly this element, or null. */
async function verified(page, handle, info) {
  for (const c of candidates(info)) {
    const loc = c.make(page);
    if ((await loc.count()) !== 1) continue;
    const same = await loc.evaluate((el, target) => el === target, handle);
    if (same) return c.code;
  }
  return null;
}

/** Describe a form control the way Playwright's locators will see it. */
async function describe(handle) {
  return handle.evaluate((el) => {
    const text = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const labelled = el.getAttribute('aria-labelledby');
    const label =
      text(el.getAttribute('aria-label')) ||
      (labelled
        ? text(
            labelled
              .split(/\s+/)
              .map((id) => el.ownerDocument.getElementById(id)?.textContent)
              .join(' '),
          )
        : '') ||
      text(el.labels && el.labels[0] ? el.labels[0].textContent : '');
    const placeholder = text(el.getAttribute('placeholder'));
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const isButton = tag === 'button' || ['submit', 'button'].includes(type);
    const role = isButton ? 'button' : type === 'password' ? null : 'textbox';
    // Accessible name, in the order Chromium computes it for these controls.
    const name = isButton ? text(el.textContent) || text(el.getAttribute('value')) || label : label || placeholder;
    return { role, name, label, placeholder, testId: el.getAttribute('data-testid') || '' };
  });
}

// What a sign-in button says. Single-page apps often give it type="button", and the same
// form usually holds other buttons (show password, forgot password), so the label decides.
const SIGN_IN = /^\s*(log ?in|sign ?in|continue|submit|next|anmelden|connexion|entrar|accedi)\b/i;

/** The form's sign-in button: by what it says, then by type="submit", then the last one. */
async function submitButton(form) {
  const buttons = await form.$$('button, input[type="submit"], input[type="button"], [role="button"]');
  const named = [];
  for (const b of buttons) named.push({ b, info: await describe(b) });
  const visible = [];
  for (const n of named) if (await n.b.isVisible()) visible.push(n);
  const bySaying = visible.find((n) => SIGN_IN.test(n.info.name));
  if (bySaying) return bySaying.b;
  for (const n of visible) if ((await n.b.getAttribute('type')) === 'submit') return n.b;
  return visible.length ? visible[visible.length - 1].b : null;
}

async function probe(url, loginPath) {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL: url });
    await page.goto(loginPath || '/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    const result = { title: await page.title(), heading: '' };
    const h = page.getByRole('heading').first();
    if (await h.count()) result.heading = ((await h.textContent()) || '').replace(/\s+/g, ' ').trim();
    if (loginPath === undefined) return result;

    // The sign-in form: the password field, the text field before it, and its submit.
    const password = await page.$('input[type="password"]');
    if (!password) throw new Error(`no password field on ${new URL(loginPath, url)} — is --login the sign-in page?`);
    const form = await password.evaluateHandle((el) => el.form || el.closest('form') || el.ownerDocument.body);
    const user = await form.asElement().$('input:not([type]), input[type="text"], input[type="email"]');
    const submit = await submitButton(form.asElement());
    if (!user || !submit)
      throw new Error('found a password field, but not the username field or submit button beside it');

    const login = { path: loginPath, unresolved: [] };
    for (const [key, handle] of [
      ['username', user],
      ['password', password],
      ['submit', submit],
    ]) {
      const info = await describe(handle);
      login[key] = await verified(page, handle, info);
      if (!login[key]) login.unresolved.push({ key, info });
    }
    result.login = login;
    return result;
  } finally {
    await browser.close();
  }
}

// ── Scaffold: pure, so it is unit-tested without a browser ──────────────────

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'app';

/** The files a target consists of, as { path: contents }. */
function scaffold({ url, name, title, heading, login }) {
  const area = slug(name);
  const files = {};
  const hasLogin = Boolean(login);

  files['app.config.ts'] =
    `// governed-change: \`npm run init\` replaced the reference target (scripts/demo-layer.json) with ${name}.
// Its tests and their assertions belonged to the demo applications, not to this one.
import { devices, type PlaywrightTestConfig, type Project } from '@playwright/test';

/**
 * The TARGET layer for ${name}, generated by \`npm run init\`.
 *
 * playwright.config.ts is the framework core and does not change. This file says what it
 * tests: where the application lives and which lanes run against it. Add lanes here as
 * the suite grows, and leave the core alone (golden rule #12).
 */
export type Target = {
  baseURL: string;
  webServer?: PlaywrightTestConfig['webServer'];
  projects: Project[];
};
${hasLogin ? "\nconst AUTH_FILE = 'test-data/.auth/user.json';\n" : ''}
/** A function, so the environment is read after .env is loaded, not at import. */
export function target({ bddDir }: { bddDir: string }): Target {
  // BASE_URL overrides the address init was given: one suite, any environment.
  const APP = process.env.BASE_URL || ${lit(url)};
${
  hasLogin
    ? `
  // The signed-in lanes need a test account: TEST_USER_EMAIL and TEST_USER_PASSWORD, in
  // .env locally and as secrets in CI. Until both are set those lanes are left out
  // rather than failing, and the coverage matrix reports what they would have covered
  // as not yet covered.
  const signedIn = Boolean(process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD);

  return {
    baseURL: APP,
    projects: [
      // Signs in once through the real form and saves the session for bdd:app.
      ...(signedIn
        ? [
            {
              name: 'setup',
              testDir: './tests',
              testMatch: /auth\\.setup\\.ts/,
              use: { ...devices['Desktop Chrome'], baseURL: APP },
            },
          ]
        : []),
      // No session injected: what a visitor sees, and signing in itself.
      {
        name: 'bdd:app-anon',
        testDir: bddDir,
        grep: /@signed-out/,
        grepInvert: signedIn ? undefined : /@credentials/,
        use: { ...devices['Desktop Chrome'], baseURL: APP },
      },
      // Every other scenario starts signed in.
      ...(signedIn
        ? [
            {
              name: 'bdd:app',
              testDir: bddDir,
              grepInvert: /@signed-out/,
              dependencies: ['setup'],
              use: { ...devices['Desktop Chrome'], baseURL: APP, storageState: AUTH_FILE },
            },
          ]
        : []),
    ],
  };
}
`
    : `
  return {
    baseURL: APP,
    projects: [
      {
        name: 'bdd:app',
        testDir: bddDir,
        use: { ...devices['Desktop Chrome'], baseURL: APP },
      },
    ],
  };
}
`
}`;

  const pages = hasLogin ? [['LoginPage', 'loginPage']] : [['HomePage', 'homePage']];
  files['fixtures/pages.fixture.ts'] = `import { test as base } from 'playwright-bdd';
import { BasePage } from '../pages/BasePage';
${pages.map(([c]) => `import { ${c} } from '../pages/${c}';`).join('\n')}

/**
 * Page Object fixtures — one entry per Page Object class.
 *
 * This file is the single source of truth for Page Object creation: tests and
 * step definitions never call \`new PageClass(page)\` directly. Add a fixture here
 * for every class you create under pages/.
 */
export type PageFixtures = {
  basePage: BasePage;
${pages.map(([c, f]) => `  ${f}: ${c};`).join('\n')}
};

export const test = base.extend<PageFixtures>({
  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },
${pages.map(([c, f]) => `  ${f}: async ({ page }, use) => {\n    await use(new ${c}(page));\n  },`).join('\n')}
});
`;

  if (hasLogin) {
    const unresolved = (key) => `this.page.getByTestId(${lit(`TODO-${key}`)})`;
    const loc = (key) => (login[key] ? `this.page.${login[key]}` : unresolved(key));
    files['pages/LoginPage.ts'] = `import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage — the sign-in form of ${name}.
 *
 * Generated by \`npm run init\` from the live page: each locator below was verified to
 * resolve to exactly one element, in golden-rule order (role, label, placeholder, test id).${
   login.unresolved.length
     ? `\n *\n * ${login.unresolved.map((u) => u.key).join(', ')}: no accessible name and no data-testid, so no rule-abiding\n * locator exists yet. Ask for a data-testid on the control and replace the TODO test id.`
     : ''
 }
 */
export class LoginPage extends BasePage {
  private username() {
    return ${loc('username')};
  }

  private password() {
    return ${loc('password')};
  }

  private submit() {
    return ${loc('submit')};
  }

  async open() {
    await this.goto(${lit(login.path)});
  }

  async login(username: string, password: string) {
    await this.open();
    await this.username().fill(username);
    await this.password().fill(password);
    await this.submit().click();
  }

  async expectFormShown() {
    await expect(this.username()).toBeVisible();
    await expect(this.password()).toBeVisible();
    await expect(this.submit()).toBeVisible();
  }

  /**
   * Signed in means the sign-in form has gone. That is true of every application, which
   * is why init can generate it; replace it with something only a signed-in user sees
   * (a heading, the account menu) as soon as you know what that is.
   */
  async expectSignedIn() {
    await expect(this.password()).toHaveCount(0, { timeout: 30_000 });
  }
}
`;
    files['tests/auth.setup.ts'] = `import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * Signs in once through the real form and saves the session, so no scenario in the
 * signed-in lane spends time on the login UI. Runs only when TEST_USER_EMAIL and
 * TEST_USER_PASSWORD are set (see app.config.ts); keep their values out of the repo.
 */
setup('authenticate', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(process.env.TEST_USER_EMAIL ?? '', process.env.TEST_USER_PASSWORD ?? '');
  await loginPage.expectSignedIn();
  await page.context().storageState({ path: 'test-data/.auth/user.json' });
});
`;
    files['features/smoke.feature'] = `@app @${area}
Feature: ${name} — smoke
  The first checks against ${name}: the sign-in form is reachable, and a test account
  can sign in. Add scenarios beside these, each tagged with the requirement it covers.

  @smoke @signed-out @req:REQ-SMOKE-001
  Scenario: A visitor is shown the sign-in form
    Given I open the sign-in page
    Then the sign-in form is shown

  @smoke @signed-out @credentials @req:REQ-SMOKE-002
  Scenario: A user can sign in
    When I sign in with the test account
    Then I am signed in
`;
    files['features/step-definitions/smoke.steps.ts'] = `import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I open the sign-in page', async ({ loginPage }) => {
  await loginPage.open();
});

Then('the sign-in form is shown', async ({ loginPage }) => {
  await loginPage.expectFormShown();
});

// The test account comes from the environment (.env locally, secrets in CI), never the repo.
When('I sign in with the test account', async ({ loginPage }) => {
  await loginPage.login(process.env.TEST_USER_EMAIL ?? '', process.env.TEST_USER_PASSWORD ?? '');
});

Then('I am signed in', async ({ loginPage }) => {
  await loginPage.expectSignedIn();
});
`;
  } else {
    const loaded = title
      ? `await expect(this.page).toHaveTitle(${lit(title)});`
      : `await expect(this.page.getByRole('heading', { name: ${lit(heading)} })).toBeVisible();`;
    files['pages/HomePage.ts'] = `import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * HomePage — the landing page of ${name}, generated by \`npm run init\`.
 *
 * The loaded check is what init found on the live page. Replace it with the element a
 * user would look for first, once you know which one that is.
 */
export class HomePage extends BasePage {
  async open() {
    await this.goto('/');
  }

  async expectLoaded() {
    ${loaded}
  }
}
`;
    files['features/smoke.feature'] = `@app @${area}
Feature: ${name} — smoke
  The first check against ${name}. Add scenarios beside it, each tagged with the
  requirement it covers.

  @smoke @req:REQ-SMOKE-001
  Scenario: The application loads
    Given I open the application
    Then the application has loaded
`;
    files['features/step-definitions/smoke.steps.ts'] = `import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';

const { Given, Then } = createBdd(test);

Given('I open the application', async ({ homePage }) => {
  await homePage.open();
});

Then('the application has loaded', async ({ homePage }) => {
  await homePage.expectLoaded();
});
`;
  }

  files['requirements/SMOKE.md'] = `---
epic: ${name}
journey: Smoke
priority: critical
---

# ${name} — smoke

Generated by \`npm run init\`. Each heading is one requirement; a scenario claims it with
a \`@req:\` tag and \`npm run coverage:requirements\` reports whether it passed. Write the
rest of your requirements beside these, including the ones you have not tested yet: an
untested requirement shows up as a gap, and an unwritten one never does.
${
  hasLogin
    ? `
## REQ-SMOKE-001 — A visitor is shown the sign-in form

**Priority:** critical

The sign-in page loads and offers a username field, a password field and a way to submit.

- Covered by: \`features/smoke.feature\` → _A visitor is shown the sign-in form_

## REQ-SMOKE-002 — A user can sign in

**Priority:** critical

A valid test account signs in and leaves the sign-in form. Runs once TEST_USER_EMAIL and
TEST_USER_PASSWORD are set; until then this requirement reports as not covered.

- Covered by: \`features/smoke.feature\` → _A user can sign in_
`
    : `
## REQ-SMOKE-001 — The application loads

**Priority:** critical

The landing page loads and shows what a user expects to see first.

- Covered by: \`features/smoke.feature\` → _The application loads_
`
}`;

  files['requirements/README.md'] = `# requirements/

The requirement catalogue. Each \`REQ-<AREA>-<NNN>\` heading is one requirement; a
scenario or spec claims it with a \`@req:\` tag, and \`npm run coverage:requirements\`
reports, from the run that just happened, whether each one passed.

A full matrix means every requirement written here passed. It is not a claim that the
application is fully tested: a requirement nobody wrote down cannot show up as missing.
Write the untested ones too. A gap with a requirement is a decision; a gap without one
is an oversight nobody will find.
`;
  return files;
}

// ── Apply ───────────────────────────────────────────────────────────────────

function rm(rel) {
  fs.rmSync(path.join(ROOT, rel), { recursive: true, force: true });
}

function write(rel, contents) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

/** package.json: the scripts that named the reference lanes now name yours. */
function retargetScripts({ hasLogin }) {
  const file = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const lanes = "--project='bdd:*'";
  Object.assign(pkg.scripts, {
    'setup:app': 'node -e "console.log(\'nothing to prepare: the application is already running at BASE_URL\')"',
    'test:app': `npm run bdd:gen && playwright test ${lanes}`,
    'bdd:test': `npm run bdd:gen && playwright test ${lanes}`,
    'bdd:smoke': `npm run bdd:gen && playwright test ${lanes} --grep @smoke`,
    'bdd:regression': `npm run bdd:gen && playwright test ${lanes} --grep-invert @wip`,
  });
  // The reference lanes only it had (demo-layer.json "scripts"); the docs check knows.
  for (const name of JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).scripts || []) delete pkg.scripts[name];
  pkg.certance = { ...(pkg.certance || {}), seedProject: hasLogin ? 'bdd:app-anon' : 'bdd:app' };
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}

/** fixtures/allure.fixture.ts: give the new feature area an Allure epic. */
function registerEpic(area, name) {
  const file = path.join(ROOT, 'fixtures/allure.fixture.ts');
  const src = fs.readFileSync(file, 'utf8');
  const next = src.replace(
    /const EPIC_BY_TAG: Record<string, string> = \{[\s\S]*?\};/,
    `const EPIC_BY_TAG: Record<string, string> = {\n  ${lit(area)}: ${lit(name)},\n};`,
  );
  fs.writeFileSync(file, next);
}

const USAGE = `Usage: npm run init -- --url <app origin> [--login [path]] [--name "<app name>"] [--no-run] [--force]

  --url     where the application under test runs (BASE_URL overrides it later)
  --login   the application has a sign-in form, at this path (default: /)
  --name    what to call it in features, requirements and reports
  --no-run  scaffold only; do not run the smoke suite afterwards
  --force   run even though the reference target is already gone`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.url) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 1);
  }
  const url = new URL(opts.url).origin;
  const name = opts.name || new URL(url).hostname;
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  const demoPresent = manifest.remove.some((p) => fs.existsSync(path.join(ROOT, p)));
  if (!demoPresent && !opts.force) {
    console.error('init: the reference target is already gone — this repository has been initialised.');
    console.error('Run with --force to scaffold again (it overwrites app.config.ts and the smoke files).');
    process.exit(1);
  }

  console.log(`init: reading ${url}${opts.login !== undefined ? ` (sign-in form at ${opts.login})` : ''} …`);
  const found = await probe(url, opts.login);

  for (const p of manifest.remove) rm(p);
  const files = scaffold({ url, name, title: found.title, heading: found.heading, login: found.login });
  for (const [rel, contents] of Object.entries(files)) write(rel, contents);
  retargetScripts({ hasLogin: Boolean(found.login) });
  registerEpic(slug(name), name);
  try {
    execFileSync('npx', ['prettier', '--write', ...Object.keys(files), 'package.json'], { cwd: ROOT, stdio: 'ignore' });
  } catch {
    /* formatting is a courtesy; lint will say if anything matters */
  }

  console.log(`\n✓ ${name} is the application under test. Removed the reference target; wrote:`);
  for (const rel of Object.keys(files)) console.log(`    ${rel}`);
  if (found.login) {
    for (const k of ['username', 'password', 'submit']) {
      console.log(
        `  ${found.login[k] ? '✓' : '✗'} ${k.padEnd(8)} ${found.login[k] || 'no rule-abiding locator — needs a data-testid (TODO in LoginPage)'}`,
      );
    }
    console.log('\n  Signed-in lanes switch on once TEST_USER_EMAIL and TEST_USER_PASSWORD are set in .env.');
  }

  if (!opts.run) return;
  console.log('\ninit: running the smoke suite …\n');
  try {
    execFileSync('npm', ['test'], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
  console.log('\nNext: write requirements in requirements/, then let the planner and generator agents');
  console.log('turn them into scenarios (docs/DEVELOPER_GUIDE.md). Every PR runs the same gates as this repo.');
}

module.exports = { parseArgs, candidates, scaffold, slug };

if (require.main === module) {
  main().catch((e) => {
    console.error(`init: ${e.message}`);
    process.exit(1);
  });
}
