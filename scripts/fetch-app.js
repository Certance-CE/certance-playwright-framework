#!/usr/bin/env node
/**
 * Fetches the demo application binary used by the reference suite.
 *
 * The framework demonstrates itself against a real third-party application rather than
 * one we wrote, because a DOM we control proves nothing about locator discipline. It is
 * run locally rather than over the internet because a hosted demo can — and did — block
 * CI traffic as a suspected bot, and because a local instance works offline, behind a
 * corporate proxy, and returns to a known state on every run.
 *
 * Vikunja is an open-source project/task manager (AGPL-3.0). We download and run an
 * unmodified release; we do not redistribute it.
 *
 * Idempotent: exits immediately if the pinned version is already present.
 * Dep-free so it works straight after `npm ci`.
 *
 * Usage: node scripts/fetch-app.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const VERSION = 'v2.5.0'; // pinned deliberately: an upgrade is a decision, not a surprise
const BIN_DIR = path.join(__dirname, '..', '.bin');
const BIN = path.join(BIN_DIR, process.platform === 'win32' ? 'vikunja.exe' : 'vikunja');
const STAMP = path.join(BIN_DIR, '.version');

/** Release assets are named by platform and architecture. */
function assetName() {
  const arch = { arm64: 'arm64', x64: 'amd64' }[process.arch];
  if (!arch) throw new Error(`unsupported architecture: ${process.arch}`);
  if (process.platform === 'darwin') return `vikunja-${VERSION}-darwin-10.15-${arch}-full.zip`;
  if (process.platform === 'linux') return `vikunja-${VERSION}-linux-${arch}-full.zip`;
  if (process.platform === 'win32') return `vikunja-${VERSION}-windows-4.0-${arch}.exe-full.zip`;
  throw new Error(`unsupported platform: ${process.platform}`);
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`download failed (HTTP ${response.status}): ${url}`);
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

/** Unzip without adding a dependency: every supported platform ships one. */
function unzip(archive, into) {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -Force -Path "${archive}" -DestinationPath "${into}"`],
      { stdio: 'ignore' },
    );
  } else {
    execFileSync('unzip', ['-q', '-o', archive, '-d', into], { stdio: 'ignore' });
  }
}

async function main() {
  if (fs.existsSync(BIN) && fs.existsSync(STAMP) && fs.readFileSync(STAMP, 'utf8').trim() === VERSION) {
    console.log(`✓ demo app ${VERSION} already present`);
    return;
  }

  const asset = assetName();
  const url = `https://github.com/go-vikunja/vikunja/releases/download/${VERSION}/${asset}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-app-'));
  const archive = path.join(tmp, asset);

  console.log(`Downloading demo application ${VERSION} for ${process.platform}/${process.arch}…`);
  await download(url, archive);
  unzip(archive, tmp);

  const files = fs.readdirSync(tmp);
  const binaryName = files.find((f) => f.startsWith('vikunja-') && !f.endsWith('.zip') && !f.endsWith('.sha256'));
  if (!binaryName) throw new Error(`no binary found inside ${asset}`);
  const extracted = path.join(tmp, binaryName);

  // The archive ships a checksum for the binary; verify before making it executable.
  //
  // Be clear about what this is worth: a checksum distributed inside the artefact it
  // describes detects a corrupted or truncated download, not a tampered release —
  // anyone able to replace the archive can replace the checksum with it. Real integrity
  // would need a signature or a digest pinned here from an independent source. This is
  // a transit check, and it is labelled as one rather than dressed up as supply-chain
  // verification.
  const checksumFile = files.find((f) => f.endsWith('.sha256'));
  if (checksumFile) {
    const expected = fs.readFileSync(path.join(tmp, checksumFile), 'utf8').trim().split(/\s+/)[0];
    const actual = crypto.createHash('sha256').update(fs.readFileSync(extracted)).digest('hex');
    if (expected !== actual) {
      throw new Error(`checksum mismatch for ${binaryName}\n  expected ${expected}\n  actual   ${actual}`);
    }
  } else {
    console.warn('  note: no checksum shipped in the archive; skipping the transit check');
  }

  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.copyFileSync(extracted, BIN);
  fs.chmodSync(BIN, 0o755);
  fs.writeFileSync(STAMP, VERSION);
  fs.rmSync(tmp, { recursive: true, force: true });

  // macOS quarantines downloaded executables; clear it so the suite can start the app.
  if (process.platform === 'darwin') {
    try {
      execFileSync('xattr', ['-d', 'com.apple.quarantine', BIN], { stdio: 'ignore' });
    } catch {
      /* attribute absent — nothing to clear */
    }
  }

  console.log(`✓ demo app ${VERSION} ready at .bin/`);
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}\n`);
  process.exit(1);
});
