#!/usr/bin/env node
/**
 * Pre-test preflight.
 *
 * Runs automatically before `npm test` (npm's `pretest` hook). Its only job is to
 * turn the two things that break a first run into one clear instruction, instead
 * of a wall of failing tests:
 *
 *   1. Node older than the version the framework supports.
 *   2. Playwright's browsers not downloaded yet — the usual cold-clone failure,
 *      which otherwise surfaces as every scenario timing out.
 *
 * Dep-free and fast (a few milliseconds) so it never becomes a reason to skip it.
 * Exits 1 with the exact command to run; exits 0 silently when all is well.
 */
const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

// Colour only when attached to a terminal that wants it.
const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, text) => (useColour ? `${code}${text}${RESET}` : text);

function fail(title, lines) {
  console.error('');
  console.error(c(RED + BOLD, `✖ ${title}`));
  console.error('');
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
}

// ── 1. Node version ─────────────────────────────────────────────────────────
function checkNode() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const required = pkg.engines && pkg.engines.node;
  if (!required) return;

  const min = Number((required.match(/(\d+)/) || [])[1]);
  const current = Number(process.versions.node.split('.')[0]);
  if (Number.isNaN(min) || current >= min) return;

  fail(`Node ${process.versions.node} is too old — this framework needs Node ${required}.`, [
    `Install a supported version, for example with ${c(BOLD, 'nvm')}:`,
    '',
    c(BOLD, '    nvm install && nvm use'),
    '',
    c(DIM, `The repo ships an .nvmrc so 'nvm use' picks the right version.`),
  ]);
}

// ── 2. Playwright browsers ──────────────────────────────────────────────────
function checkBrowsers() {
  let executable;
  try {
    // Resolved through Playwright itself, so PLAYWRIGHT_BROWSERS_PATH and any
    // corporate mirror configuration are honoured automatically.
    executable = require('@playwright/test').chromium.executablePath();
  } catch {
    return; // Playwright not resolvable yet — `npm ci` will surface that far more clearly.
  }

  if (executable && fs.existsSync(executable)) return;

  fail('Playwright needs to download a browser before the first run.', [
    'Run this once, then try again:',
    '',
    c(BOLD, '    npx playwright install chromium'),
    '',
    c(DIM, 'Behind a corporate proxy or mirror, see docs — PLAYWRIGHT_DOWNLOAD_HOST,'),
    c(DIM, 'HTTPS_PROXY and NODE_EXTRA_CA_CERTS are all respected.'),
  ]);
}

checkNode();
checkBrowsers();

if (process.env.PREFLIGHT_VERBOSE) {
  console.log(c(YELLOW, `✓ preflight ok — node ${process.versions.node}, browser present`));
}
