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

// The test account lives in .env, as for the suite; without this the probe cannot see it.
try {
  require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
} catch {
  /* dotenv is a dev dependency; without it, real environment variables still work */
}
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
    else if (a === '--api') opts.api = next();
    else if (a === '--totp') opts.totp = true;
    else if (a === '--sso') opts.sso = next();
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
    const isLink = tag === 'a';
    const role = isButton ? 'button' : isLink ? 'link' : type === 'password' ? null : 'textbox';
    // Accessible name, in the order Chromium computes it for these controls.
    const name =
      isButton || isLink ? text(el.textContent) || text(el.getAttribute('value')) || label : label || placeholder;
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

async function probe(url, loginPath, { totp: wantsTotp = false, sso } = {}) {
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

    const login = { path: loginPath, unresolved: [] };
    const env = process.env;
    const haveAccount = Boolean(env.TEST_USER_EMAIL && env.TEST_USER_PASSWORD);
    const appOrigin = new URL(url).origin;
    const record = async (key, handle) => {
      const info = await describe(handle);
      login[key] = await verified(page, handle, info);
      if (!login[key]) login.unresolved.push({ key, info });
    };

    // Single sign-on: the application's page hands over to an identity provider. Follow it,
    // and read the sign-in form on whatever origin the provider serves it from.
    if (sso) {
      // Exact name first; then a unique partial match, because people type what they see and a
      // button reads "Log in with Okta" where they typed "Okta". The locator written is the
      // button's full, verified name either way.
      const byName = (exact) =>
        page.getByRole('button', { name: sso, exact }).or(page.getByRole('link', { name: sso, exact }));
      let entry = byName(true);
      if ((await entry.count()) !== 1) entry = byName(false);
      const found = await entry.count();
      if (found !== 1) {
        throw new Error(
          `${found ? `${found} buttons or links` : 'no button or link'} named like "${sso}" on ${new URL(loginPath, url)}`,
        );
      }
      const handle = await entry.elementHandle();
      await record('sso', handle);
      await handle.click();
      await page.waitForURL((u) => u.origin !== appOrigin, { timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded');
      if (new URL(page.url()).origin !== appOrigin) login.idpOrigin = new URL(page.url()).origin;
    }

    const visiblePassword = () => page.$('input[type="password"]:visible');
    let password = await visiblePassword();
    let user;
    let submit;
    if (password) {
      // One page: the password field, the text field before it, and its submit.
      const form = await password.evaluateHandle((el) => el.form || el.closest('form') || el.ownerDocument.body);
      user = await form.asElement().$('input:not([type]), input[type="text"], input[type="email"]');
      submit = await submitButton(form.asElement());
      if (!user || !submit)
        throw new Error('found a password field, but not the username field or submit button beside it');
      for (const [key, handle] of [
        ['username', user],
        ['password', password],
        ['submit', submit],
      ])
        await record(key, handle);
    } else {
      // Username first (the shape Okta and Entra ID use): a username or email field and a
      // button; the password field only exists on the next page, so it can only be read by
      // continuing with the customer's test account.
      user = await page.$(
        'input[autocomplete="username"], input[autocomplete="email"], input[type="email"], input[type="text"]:visible',
      );
      if (!user) throw new Error(`no sign-in form on ${page.url()}: no password field, and no username field`);
      const form = await user.evaluateHandle((el) => el.form || el.closest('form') || el.ownerDocument.body);
      const next = await submitButton(form.asElement());
      if (!next) throw new Error('found a username field, but no button to continue with');
      await record('username', user);
      await record('next', next);
      if (haveAccount) {
        await user.fill(env.TEST_USER_EMAIL);
        await next.click();
        password = await page
          .waitForSelector('input[type="password"]', { state: 'visible', timeout: 15_000 })
          .catch(() => null);
        if (!password) throw new Error('continued with the test account, but no password field followed');
        const form2 = await password.evaluateHandle((el) => el.form || el.closest('form') || el.ownerDocument.body);
        submit = await submitButton(form2.asElement());
        await record('password', password);
        if (submit) await record('submit', submit);
      } else {
        login.passwordStep = { discovered: false };
      }
    }

    // With the customer's test account, finish signing in once, so the generated LoginPage is
    // proven end to end: the one-time code step (if any) and the way back to the application.
    if (haveAccount && password && submit) {
      if (user && !login.next) await user.fill(env.TEST_USER_EMAIL);
      await password.fill(env.TEST_USER_PASSWORD);
      await submit.click();
      if (env.TEST_USER_TOTP_SECRET) login.code = await discoverCodeStep(page, env);
      login.signedIn = await signedInAfter(page, { appOrigin, loginPath, sso: Boolean(sso) });
    }
    if (!login.code && wantsTotp) login.code = { discovered: false };
    result.login = login;
    return result;
  } finally {
    await browser.close();
  }
}

/**
 * One anonymous GET of a read-only endpoint: what it answers, so the generated contract
 * test asserts what the API really returns rather than what someone remembers it returns.
 */
async function probeApi(endpoint) {
  const { request } = require('@playwright/test');
  const target = new URL(endpoint);
  const ctx = await request.newContext({ extraHTTPHeaders: { Accept: 'application/json' } });
  try {
    const res = await ctx.get(target.href);
    const status = res.status();
    if (status >= 400) {
      throw new Error(
        `GET ${target.href} answered ${status}. Give --api a read-only endpoint that answers without credentials, such as a health or info endpoint.`,
      );
    }
    const contentType = (res.headers()['content-type'] || '').split(';')[0].trim();
    let json;
    if (/json/i.test(contentType)) {
      try {
        json = await res.json();
      } catch {
        json = undefined; // says JSON, is not: assert the status and type only
      }
    }
    return { origin: target.origin, path: `${target.pathname}${target.search}`, status, contentType, json };
  } finally {
    await ctx.dispose();
  }
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const MAX_FIELDS = 12;

/**
 * zod source for a JSON value as the API returned it. Types only, never values (a
 * version string that changes every release must not fail the contract). Nested
 * objects to two levels; arrays and nulls as unknown, because one sample cannot say
 * what they hold the rest of the time.
 */
function schemaFor(value, depth = 0, indent = '') {
  if (value === null || value === undefined) return 'z.unknown()';
  if (Array.isArray(value)) return 'z.array(z.unknown())';
  if (typeof value === 'string') return 'z.string()';
  if (typeof value === 'number') return 'z.number()';
  if (typeof value === 'boolean') return 'z.boolean()';
  if (typeof value !== 'object') return 'z.unknown()';
  if (depth >= 2) return 'z.record(z.string(), z.unknown())';
  const keys = Object.keys(value);
  if (!keys.length) return 'z.object({})';
  const inner = `${indent}  `;
  const lines = keys
    .slice(0, MAX_FIELDS)
    .map((k) => `${inner}${IDENT.test(k) ? k : lit(k)}: ${schemaFor(value[k], depth + 1, inner)},`);
  if (keys.length > MAX_FIELDS) {
    lines.push(`${inner}// ${keys.length - MAX_FIELDS} more field(s) not asserted: add the ones you rely on.`);
  }
  return `z.object({\n${lines.join('\n')}\n${indent}})`;
}

/**
 * Sign in on the customer's own test environment and find the one-time code field that
 * appears after the password, by the HTML standard's autocomplete="one-time-code" (what
 * authenticator-friendly sign-in pages use). Returns verified locators for the field and
 * the button that submits it, and whether the code actually signed the account in.
 */
async function discoverCodeStep(page, env) {
  const { totp } = loadTotp();
  const field = await page
    .waitForSelector('input[autocomplete="one-time-code"]', { timeout: 15_000 })
    .catch(() => null);
  if (!field) return { discovered: false, note: 'no one-time code field appeared after the password' };
  const form = await field.evaluateHandle((el) => el.form || el.closest('form') || el.ownerDocument.body);
  const confirm = await submitButton(form.asElement());
  const code = { discovered: true, field: await verified(page, field, await describe(field)) };
  code.submit = confirm ? await verified(page, confirm, await describe(confirm)) : null;
  // Claimed in the same register the suite uses (utils/totp.ts unusedTotp), or the suite's
  // first sign-in, seconds later, would reuse this code and be rejected (measured).
  await field.fill(await claimUnusedCode(env.TEST_USER_TOTP_SECRET, totp));
  if (confirm) await confirm.click();
  return code;
}

/**
 * Whether the sign-in just submitted worked. Through an identity provider: back on the
 * application, off its sign-in page. A form on the application itself: its password field
 * has gone. (An identity provider's error page has no password field either, which is why
 * SSO is judged by where the browser ends up.)
 */
async function signedInAfter(page, { appOrigin, loginPath, sso }) {
  const check = sso
    ? page.waitForURL((u) => u.origin === appOrigin && !u.pathname.startsWith(loginPath), { timeout: 20_000 })
    : page.waitForFunction(() => !globalThis.document.querySelector('input[type="password"]'), null, {
        timeout: 15_000,
      });
  return check.then(() => true).catch(() => false);
}

/**
 * The same claim as utils/totp.ts unusedTotp, in plain Node: one marker file per account and
 * 30-second step, created atomically; a taken step means waiting for the next. Same file names,
 * so init's probe and the suite share one register.
 */
async function claimUnusedCode(secret, totp) {
  const crypto = require('node:crypto');
  const dir = path.join(ROOT, 'test-data/.auth/totp');
  fs.mkdirSync(dir, { recursive: true });
  const account = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 12);
  for (let attempt = 0; attempt < 3; attempt++) {
    const at = Date.now();
    const step = Math.floor(at / 30_000);
    try {
      fs.closeSync(fs.openSync(path.join(dir, `${account}-${step}`), 'wx'));
      return totp(secret, at);
    } catch (e) {
      // Our own message: the error's file path is derived from the secret's hash.
      if (e.code !== 'EEXIST')
        throw new Error(`could not write the one-time code register in ${dir} (${e.code})`, { cause: e });
      await new Promise((resolve) => globalThis.setTimeout(resolve, (step + 1) * 30_000 - Date.now() + 50));
    }
  }
  throw new Error('could not claim an unused one-time code');
}

/** utils/totp.ts, loaded through Playwright's TypeScript support so init stays plain Node. */
function loadTotp() {
  try {
    return require('../utils/totp');
  } catch {
    // Plain node cannot load .ts. A tiny copy of the same RFC 6238 algorithm, for the probe only.
    const crypto = require('node:crypto');
    const b32 = (sec) => {
      let bits = '';
      for (const c of sec.replace(/[\s=-]/g, '').toUpperCase())
        bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0');
      const out = [];
      for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
      return Buffer.from(out);
    };
    const totp = (sec, at = Date.now()) => {
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
      const h = crypto.createHmac('sha1', b32(sec)).update(counter).digest();
      const o = h[h.length - 1] & 15;
      return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
    };
    return { totp };
  }
}

// ── Scaffold: pure, so it is unit-tested without a browser ──────────────────

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'app';

/** The files a target consists of, as { path: contents }. */
function scaffold({ url, name, title, heading, login, api }) {
  const area = slug(name);
  const files = {};
  const hasLogin = Boolean(login);

  files['app.config.ts'] =
    `// governed-change: \`npm run init\` replaced the reference target (scripts/demo-layer.json) with ${name}.
// Its tests and their assertions belonged to the demo applications, not to this one.
${hasLogin ? "import { existsSync } from 'node:fs';\n" : ''}import { devices, type PlaywrightTestConfig, type Project } from '@playwright/test';

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
  const APP = process.env.BASE_URL || ${lit(url)};${
    api
      ? `
  // The API the api lane calls. APP_API_URL overrides it; the api fixture reads it from here.
  const API = process.env.APP_API_URL || ${lit(api.origin)};
  process.env.APP_API_URL = API;`
      : ''
  }
${
  hasLogin
    ? `
  // The signed-in lanes need a test account: TEST_USER_EMAIL and TEST_USER_PASSWORD, in
  // .env locally and as secrets in CI. Until both are set those lanes are left out
  // rather than failing, and the coverage matrix reports what they would have covered
  // as not yet covered.
  // ... or by a session captured by hand (npm run auth:capture), locally or as the CI secret
  // STORAGE_STATE_BASE64, for sign-ins a test cannot answer (push notification, hardware key).
  const signedIn = Boolean(
    (process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) ||
      process.env.STORAGE_STATE_BASE64 ||
      existsSync('test-data/.auth/captured.json'),
  );

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
        : []),${
          api
            ? `
      // The API lane: HTTP only, no browser.
      {
        name: 'api',
        testDir: './tests/api',
        use: { baseURL: API },
      },`
            : ''
        }
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
      },${
        api
          ? `
      // The API lane: HTTP only, no browser.
      {
        name: 'api',
        testDir: './tests/api',
        use: { baseURL: API },
      },`
          : ''
      }
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
    const code = login.code;
    // A code field seen on the live page gets its verified locator; one not seen yet gets a
    // label match that says so, because a guessed locator presented as verified is the
    // overclaim this framework exists to prevent.
    const codeField = code?.field
      ? `this.page.${code.field}`
      : `this.page.getByLabel(/one-time|two.?factor|verification code|authentication code|security code/i)`;
    const codeSubmit = code?.submit ? `this.page.${code.submit}` : 'this.submit()';
    // A username-first sign-in whose password page init could not reach (no test account in
    // .env): marked fallbacks, never presented as verified.
    const unseenPassword = Boolean(login.passwordStep && !login.passwordStep.discovered);
    const passwordLoc = unseenPassword ? 'this.page.getByLabel(/password/i)' : loc('password');
    const submitLoc = unseenPassword
      ? "this.page.getByRole('button', { name: /sign in|log ?in|continue|submit/i })"
      : loc('submit');
    const viaSso = Boolean(login.sso);
    files['pages/LoginPage.ts'] = `import { expect } from '@playwright/test';
import { BasePage } from './BasePage';${code ? "\nimport { unusedTotp } from '../utils/totp';" : ''}

/**
 * LoginPage — the sign-in form of ${name}.
 *
 * Generated by \`npm run init\` from the live page: each locator below was verified to
 * resolve to exactly one element, in golden-rule order (role, label, placeholder, test id).${
   viaSso
     ? `\n *\n * Sign-in is single sign-on: the application hands over to an identity provider${
         login.idpOrigin ? ` (${login.idpOrigin})` : ''
       }, and the\n * form below is the provider's.`
     : ''
 }${
   unseenPassword
     ? `\n *\n * NOT YET SEEN: the password page. It only appears after a username, so init could not read\n * it without a test account; password() and submit() are label matches. Run init again with\n * TEST_USER_EMAIL and TEST_USER_PASSWORD in .env to verify them.`
     : ''
 }${
   login.unresolved.length
     ? `\n *\n * ${login.unresolved.map((u) => u.key).join(', ')}: no accessible name and no data-testid, so no rule-abiding\n * locator exists yet. Ask for a data-testid on the control and replace the TODO test id.`
     : ''
 }
 */
export class LoginPage extends BasePage {${
      viaSso
        ? `
  /** The application's button that hands over to the identity provider. */
  private signInWithProvider() {
    return ${loc('sso')};
  }
`
        : ''
    }
  private username() {
    return ${loc('username')};
  }
${
  login.next
    ? `
  /** Username first: this button leads to the password page. */
  private next() {
    return ${loc('next')};
  }
`
    : ''
}
  private password() {
    return ${passwordLoc};
  }

  private submit() {
    return ${submitLoc};
  }
${
  code
    ? `
  /**
   * The one-time code step${code.discovered ? ', found on the live page after a correct password' : ''}.${
     code.discovered
       ? ''
       : `\n   * NOT YET SEEN: init had no test account with an authenticator secret, so this is a label\n   * match. Run init again with TEST_USER_* and TEST_USER_TOTP_SECRET in .env to verify it.`
   }
   */
  private oneTimeCode() {
    return ${codeField};
  }

  private confirmCode() {
    return ${codeSubmit};
  }
`
    : ''
}
  async open() {
    await this.goto(${lit(login.path)});${viaSso ? '\n    await this.signInWithProvider().click();' : ''}
  }

  async login(username: string, password: string${code ? ', totpSecret?: string' : ''}) {
    await this.open();
    await this.username().fill(username);${login.next ? '\n    await this.next().click();' : ''}
    await this.password().fill(password);
    await this.submit().click();${
      code
        ? `
    // An account with an authenticator: the code is generated from its secret, as the app would
    // show it (utils/totp.ts, RFC 6238), and claimed once per run, because a code works once.
    // The secret comes from the caller, never this file.
    if (totpSecret) {
      await expect(this.oneTimeCode()).toBeVisible();
      await this.oneTimeCode().fill(await unusedTotp(totpSecret));
      await this.confirmCode().click();
    }`
        : ''
    }
  }

  async expectFormShown() {
    await expect(this.username()).toBeVisible();${
      login.next
        ? `
    // Username first: the password field is on the next page, so the first page shows the
    // username and the button that continues.
    await expect(this.next()).toBeVisible();`
        : `
    await expect(this.password()).toBeVisible();
    await expect(this.submit()).toBeVisible();`
    }
  }

${
  viaSso
    ? `  /**
   * Signed in means back on the application, off its sign-in page. Through an identity
   * provider, "the password field has gone" is not enough: the provider's own error page has
   * no password field either. Replace this with something only a signed-in user sees as soon
   * as you know what that is.
   */
  async expectSignedIn() {
    await expect(this.page).toHaveURL(
      (url) => ${login.idpOrigin ? `url.origin !== ${lit(login.idpOrigin)} && ` : ''}!url.pathname.startsWith(${lit(login.path)}),
      { timeout: 30_000 },
    );
  }`
    : `  /**
   * Signed in means the sign-in form has gone. That is true of every application, which
   * is why init can generate it; replace it with something only a signed-in user sees
   * (a heading, the account menu) as soon as you know what that is.
   */
  async expectSignedIn() {
    await expect(this.password()).toHaveCount(0, { timeout: 30_000 });
  }`
}
}
`;
    files['tests/auth.setup.ts'] = `import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { test as setup } from '@playwright/test';
import { epic } from 'allure-js-commons';
import { LoginPage } from '../pages/LoginPage';

const AUTH_FILE = 'test-data/.auth/user.json';
const CAPTURED = 'test-data/.auth/captured.json';

/**
 * Signs in once and saves the session, so no scenario in the signed-in lane spends time on
 * the login UI. Two ways in, and app.config.ts runs this only when one of them is available:
 *
 *  - a test account (TEST_USER_EMAIL, TEST_USER_PASSWORD, optionally TEST_USER_TOTP_SECRET):
 *    signs in through the real form;
 *  - a session captured by hand with \`npm run auth:capture\` (or, in CI, the same session as
 *    the STORAGE_STATE_BASE64 secret), for sign-ins a test cannot answer. It is checked
 *    before use: an expired session fails here, once, with what to do about it.
 *
 * Keep every one of these values out of the repository.
 */
setup('authenticate', async ({ browser, page }) => {
  await epic('Session setup'); // groups this run in the quality report
  const account = process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD;
  if (process.env.STORAGE_STATE_BASE64) {
    mkdirSync('test-data/.auth', { recursive: true });
    writeFileSync(CAPTURED, Buffer.from(process.env.STORAGE_STATE_BASE64, 'base64'));
  }
  if (!account && existsSync(CAPTURED)) {
    const context = await browser.newContext({ storageState: CAPTURED, baseURL: setup.info().project.use.baseURL });
    const captured = await context.newPage();
    await captured.goto('/');
    await new LoginPage(captured).expectSignedIn().catch(() => {
      throw new Error('the captured session no longer signs in (it has expired): run npm run auth:capture again');
    });
    await context.storageState({ path: AUTH_FILE });
    await context.close();
    return;
  }
  const loginPage = new LoginPage(page);
  await loginPage.login(process.env.TEST_USER_EMAIL ?? '', process.env.TEST_USER_PASSWORD ?? ''${login.code ? ', process.env.TEST_USER_TOTP_SECRET' : ''});
  await loginPage.expectSignedIn();
  await page.context().storageState({ path: AUTH_FILE });
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

  @perf @signed-out @req:REQ-SMOKE-003
  Scenario: The sign-in page loads within its performance budget
    Given I open the sign-in page
    Then the page meets its performance budget
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
  await loginPage.login(process.env.TEST_USER_EMAIL ?? '', process.env.TEST_USER_PASSWORD ?? ''${login.code ? ', process.env.TEST_USER_TOTP_SECRET' : ''});
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

  @perf @req:REQ-SMOKE-002
  Scenario: The application loads within its performance budget
    Given I open the application
    Then the page meets its performance budget
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

**Priority:** critical <!-- proposed by npm run init: a visitor blocked from signing in is blocked from everything -->

The sign-in page loads and offers a username field, a password field and a way to submit.

- Covered by: \`features/smoke.feature\` → _A visitor is shown the sign-in form_

## REQ-SMOKE-002 — A user can sign in

**Priority:** critical <!-- proposed by npm run init: signing in is the core journey -->

A valid test account signs in and leaves the sign-in form. Runs once TEST_USER_EMAIL and
TEST_USER_PASSWORD are set; until then this requirement reports as not covered.

- Covered by: \`features/smoke.feature\` → _A user can sign in_

## REQ-SMOKE-003 — The sign-in page loads within its performance budget

**Priority:** normal <!-- proposed by npm run init: a slow page is still usable; tighten once you know your target -->

The sign-in page meets the Core Web Vitals "good" thresholds, measured in a real browser: LCP ≤ 2.5 s,
CLS ≤ 0.1, TTFB ≤ 800 ms. Tighten the budget in the scenario once you know your own target.

- Covered by: \`features/smoke.feature\` → _The sign-in page loads within its performance budget_
`
    : `
## REQ-SMOKE-001 — The application loads

**Priority:** critical <!-- proposed by npm run init: if the application does not load, nothing else works -->

The landing page loads and shows what a user expects to see first.

- Covered by: \`features/smoke.feature\` → _The application loads_

## REQ-SMOKE-002 — The application loads within its performance budget

**Priority:** normal <!-- proposed by npm run init: a slow page is still usable; tighten once you know your target -->

The landing page meets the Core Web Vitals "good" thresholds, measured in a real browser: LCP ≤ 2.5 s,
CLS ≤ 0.1, TTFB ≤ 800 ms. Tighten the budget in the scenario once you know your own target.

- Covered by: \`features/smoke.feature\` → _The application loads within its performance budget_
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

  if (api) {
    const contract = api.json !== undefined;
    files[`tests/api/${area}.api.spec.ts`] = `import { test, expect } from '../../fixtures';
${contract ? "import { z } from 'zod';\nimport { expectSchema } from '../../utils/contract';\n" : ''}
/**
 * The first API check for ${name}, generated by \`npm run init\` from one live GET of
 * ${api.path}.
${
  contract
    ? ` *
 * The schema holds the fields the endpoint returned at that moment, with the types it
 * returned. It is deliberately not \`.strict()\`: the provider ADDING a field is backwards-
 * compatible and must not fail, while DROPPING one or changing its type is what breaks a
 * caller, and that is what this catches. Trim it to the fields you rely on.
 */
const Response = ${schemaFor(api.json)};
`
    : ` *
 * It answered ${api.contentType || 'without a content type'}, not JSON, so there is no schema
 * to hold it to: the check is the status and the content type.
 */
`
}
test.describe(${lit(`${name} — API`)}, () => {
  test(
    ${lit(`${api.path} answers with its contract`)},
    { tag: ['@${area}', '@smoke', '@req:REQ-API-001'] },
    async ({ api }) => {
      const response = await api.get(${lit(api.path)});
      expect(response.status()).toBe(${api.status});
      ${
        contract
          ? `await expectSchema(response, Response, ${lit(`GET ${api.path}`)});`
          : `expect(response.headers()['content-type']).toContain(${lit(api.contentType)});`
      }
    },
  );
});
`;
    files['requirements/API.md'] = `---
epic: ${name}
journey: API
priority: critical
---

# ${name} — API

Generated by \`npm run init\` from one live GET. The API lane runs over HTTP with no
browser, in seconds; add a requirement here for every endpoint the product depends on.

## REQ-API-001 — ${api.path} answers with its contract

**Priority:** critical <!-- proposed by npm run init: the API answering with its contract is what callers rely on -->

\`GET ${api.path}\` answers ${api.status}${
      contract
        ? ', and its body still carries every field it carried when the contract was written, with the same types. A field added by the provider is allowed; one dropped or retyped fails.'
        : ` with \`${api.contentType}\`.`
    }

- Covered by: \`tests/api/${area}.api.spec.ts\` → _${api.path} answers with its contract_
`;
  }
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
function retargetScripts({ hasLogin, name, hasApi }) {
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
  if (hasApi) pkg.scripts['test:api'] = 'playwright test --project=api';
  pkg.certance = {
    ...(pkg.certance || {}),
    seedProject: hasLogin ? 'bdd:app-anon' : 'bdd:app',
    reportName: `${name} — quality report`, // allurerc.mjs titles the report with it
  };
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

const USAGE = `Usage: npm run init -- --url <app origin> [--login [path]] [--api <endpoint url>] [--name "<app name>"] [--no-run] [--force]

  --url     where the application under test runs (BASE_URL overrides it later)
  --login   the application has a sign-in form, at this path (default: /)
  --totp    the test account signs in with a one-time code (TEST_USER_TOTP_SECRET in .env)
  --sso     the name of the button or link that signs in through an identity provider
  --api     a read-only API endpoint (a health or info URL): one anonymous GET, then a contract test
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

  // The same check `npm test` runs first: an old Node or a missing browser becomes one clear
  // instruction instead of Playwright's raw launch error. init is a customer's first command.
  try {
    execFileSync('node', [path.join(__dirname, 'preflight.js')], { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }

  console.log(`init: reading ${url}${opts.login !== undefined ? ` (sign-in form at ${opts.login})` : ''} …`);
  const found = await probe(url, opts.login, { totp: opts.totp, sso: opts.sso });
  if (opts.api) {
    console.log(`init: reading ${opts.api} (one GET) …`);
    found.api = await probeApi(opts.api);
  }

  for (const p of manifest.remove) rm(p);
  const files = scaffold({ url, name, title: found.title, heading: found.heading, login: found.login, api: found.api });
  for (const [rel, contents] of Object.entries(files)) write(rel, contents);
  retargetScripts({ hasLogin: Boolean(found.login), name, hasApi: Boolean(found.api) });
  registerEpic(slug(name), name);
  try {
    execFileSync('npx', ['prettier', '--write', ...Object.keys(files), 'package.json'], { cwd: ROOT, stdio: 'ignore' });
  } catch {
    /* formatting is a courtesy; lint will say if anything matters */
  }

  console.log(`\n✓ ${name} is the application under test. Removed the reference target; wrote:`);
  for (const rel of Object.keys(files)) console.log(`    ${rel}`);
  if (found.login) {
    if (found.login.sso)
      console.log(`  ✓ sso      ${found.login.sso}${found.login.idpOrigin ? ` → ${found.login.idpOrigin}` : ''}`);
    for (const k of ['username', ...(found.login.next ? ['next'] : []), 'password', 'submit']) {
      if (found.login.passwordStep && !found.login.passwordStep.discovered && (k === 'password' || k === 'submit')) {
        console.log(`  ⚠ ${k.padEnd(8)} not seen yet (password page needs the test account in .env)`);
        continue;
      }
      console.log(
        `  ${found.login[k] ? '✓' : '✗'} ${k.padEnd(8)} ${found.login[k] || 'no rule-abiding locator — needs a data-testid (TODO in LoginPage)'}`,
      );
    }
    const c = found.login.code;
    if (c) {
      console.log(
        c.discovered
          ? `  ${c.field ? '✓' : '✗'} code     ${c.field || 'no rule-abiding locator'}`
          : `  ⚠ code     not seen yet: label fallback in LoginPage${c.note ? ` (${c.note})` : ''}`,
      );
    }
    if (found.login.signedIn !== undefined) {
      console.log(
        found.login.signedIn
          ? '  ✓ signed in with the test account, through every step above'
          : '  ✗ the test account did NOT complete sign-in: check the account, or the steps above',
      );
    }
    console.log('\n  Signed-in lanes switch on once TEST_USER_EMAIL and TEST_USER_PASSWORD are set in .env.');
  }
  if (found.api) {
    const fields = found.api.json && typeof found.api.json === 'object' ? Object.keys(found.api.json).length : 0;
    console.log(
      `  ✓ api      GET ${found.api.path} → ${found.api.status} ${found.api.contentType}${fields ? `, ${fields} field(s) in the contract` : ''}`,
    );
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

/**
 * Remove the test account's values from a message before it is printed. Errors from a browser
 * or a file system can quote what they were given; the account's password and authenticator
 * secret must never reach a terminal or a CI log.
 */
function redact(message) {
  let out = message;
  for (const name of ['TEST_USER_PASSWORD', 'TEST_USER_TOTP_SECRET', 'APP_API_TOKEN']) {
    const value = process.env[name];
    if (value && value.length >= 4) out = out.split(value).join(`[${name}]`);
  }
  return out;
}

module.exports = { parseArgs, candidates, scaffold, schemaFor, slug, redact };

if (require.main === module) {
  main().catch((e) => {
    console.error(`init: ${redact(String(e && e.message))}`);
    process.exit(1);
  });
}
