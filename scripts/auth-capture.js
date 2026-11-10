#!/usr/bin/env node
/**
 * `npm run auth:capture` — sign in by hand once, and save the session for the suite and CI.
 *
 *   npm run auth:capture -- --url https://staging.your-app.com --login /login
 *
 * For the sign-ins a test cannot answer: a push notification, a hardware key, an SMS code, a
 * CAPTCHA. It opens a real browser window on the sign-in page; a person signs in however their
 * organisation requires. The session is saved when the browser is back on the application, off
 * its sign-in page, with no password field showing, or when the person presses Enter.
 *
 * It is written to test-data/.auth/captured.json (git-ignored). The setup project checks that it
 * still signs in before every run and fails with a clear message once it has expired. For CI,
 * this prints the command that stores it as the STORAGE_STATE_BASE64 secret; it never prints the
 * session itself, which is as sensitive as a password while it lasts.
 *
 * Options:
 *   --url <origin>    the application (default: BASE_URL)
 *   --login <path>    its sign-in page (default: /login)
 *   --out <file>      where to save (default: test-data/.auth/captured.json)
 *   --timeout <min>   how long to wait for the person (default: 10)
 *   --debug-port <n>  expose the browser on this port (how the automated test plays the person)
 */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = path.join(__dirname, '..');
try {
  require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
} catch {
  /* dotenv is a dev dependency; real environment variables still work */
}

function parseArgs(argv) {
  const opts = { login: '/login', out: 'test-data/.auth/captured.json', timeout: 10, headless: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--url') opts.url = next();
    else if (a === '--login') opts.login = next();
    else if (a === '--out') opts.out = next();
    else if (a === '--timeout') opts.timeout = Number(next());
    else if (a === '--debug-port') opts.debugPort = Number(next());
    else if (a === '--headless')
      opts.headless = true; // for the automated test only
    else throw new Error(`unknown option ${a}`);
  }
  opts.url = opts.url || process.env.BASE_URL;
  if (!opts.url) throw new Error('say which application: --url <origin>, or BASE_URL in .env');
  opts.url = new URL(opts.url).origin;
  return opts;
}

/** Signed in: on the application's origin, off its sign-in page, and no password field showing. */
async function looksSignedIn(page, { url, login }) {
  const here = new URL(page.url());
  if (here.origin !== url || here.pathname.startsWith(login)) return false;
  return (await page.locator('input[type="password"]:visible').count()) === 0;
}

/** The command that stores the session as a CI secret. Printed, never run, never the content. */
function ciInstructions(file) {
  return [
    `  base64 < ${file} | gh secret set STORAGE_STATE_BASE64`,
    '  (GitHub Actions; on another CI, store the same base64 text as a masked secret variable)',
  ];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({
    headless: opts.headless,
    args: opts.debugPort ? [`--remote-debugging-port=${opts.debugPort}`] : [],
  });
  const context = await browser.newContext({ baseURL: opts.url });
  const page = await context.newPage();
  await page.goto(opts.login);

  console.log(`auth:capture: sign in to ${opts.url} in the browser window, however you normally would.`);
  console.log('              The session is saved when you are back in the application, or press Enter.');

  // Done when the person presses Enter, or when the browser shows a signed-in application.
  let pressed = false;
  const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin }) : null;
  rl?.once('line', () => (pressed = true));
  const deadline = Date.now() + opts.timeout * 60_000;
  let signedIn = false;
  while (Date.now() < deadline) {
    const pages = context.pages();
    const current = pages[pages.length - 1] || page;
    if (pressed || (await looksSignedIn(current, opts).catch(() => false))) {
      signedIn = true;
      break;
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1_000));
  }
  rl?.close();
  if (!signedIn) {
    await browser.close();
    throw new Error(`no sign-in within ${opts.timeout} minutes; nothing was saved`);
  }

  const out = path.resolve(ROOT, opts.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await context.storageState({ path: out });
  await browser.close();
  const rel = path.relative(ROOT, out);
  console.log(`\n✓ session saved to ${rel} (git-ignored). The setup project checks it still signs in on every run.`);
  console.log('\nFor CI, store it as a secret (this prints a command; it does not run it):');
  for (const line of ciInstructions(rel)) console.log(line);
  console.log('\nRun this again when setup reports that the session has expired.');
}

module.exports = { parseArgs, looksSignedIn, ciInstructions };

if (require.main === module) {
  main().catch((e) => {
    console.error(`auth:capture: ${e && e.message}`);
    process.exit(1);
  });
}
