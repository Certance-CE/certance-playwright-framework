import { describe, it, expect, vi, afterEach } from 'vitest';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { base32Decode, totp, unusedTotp } from '../utils/totp';

/**
 * The one-time code generator, pinned to the test vectors in RFC 6238 Appendix B (SHA1). A
 * wrong code does not fail loudly: sign-in simply never completes, which looks like a broken
 * application. So the generator is checked against the standard, not against itself.
 */
// RFC 6238's SHA1 key is the ASCII string "12345678901234567890"; this is its base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp — RFC 6238 Appendix B vectors (SHA1)', () => {
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];
  for (const [seconds, expected] of vectors) {
    it(`T=${seconds} gives ${expected}`, () => {
      expect(totp(RFC_SECRET, seconds * 1000, 8)).toBe(expected);
    });
  }

  it('gives the last six of those digits by default, which is what authenticator apps show', () => {
    expect(totp(RFC_SECRET, 59 * 1000)).toBe('287082');
  });

  it('is the same code throughout a 30-second step, and changes at the next one', () => {
    expect(totp(RFC_SECRET, 60_000)).toBe(totp(RFC_SECRET, 89_999));
    expect(totp(RFC_SECRET, 89_999)).not.toBe(totp(RFC_SECRET, 90_000));
  });
});

describe('base32Decode', () => {
  it('decodes the RFC key, ignoring case, spaces, dashes and padding', () => {
    expect(base32Decode(RFC_SECRET).toString('ascii')).toBe('12345678901234567890');
    expect(base32Decode('gezd gnbv-gy3t qojq gezd gnbv gy3t qojq====').toString('ascii')).toBe('12345678901234567890');
  });

  it('rejects a secret that is not base32, rather than producing wrong codes', () => {
    expect(() => base32Decode('GEZD1')).toThrow(/character 5 is not A–Z or 2–7/);
    // The message names a position and never quotes the secret.
    expect(() => base32Decode('GEZD1')).not.toThrow(/GEZD|"1"/);
    expect(() => base32Decode('  ')).toThrow(/empty/);
  });
});

describe('unusedTotp — a code works once, so each step is claimed once', () => {
  const dir = () => mkdtempSync(path.join(tmpdir(), 'totp-'));

  it('hands out the current code when nobody has used this step', async () => {
    const at = 59_000;
    expect(await unusedTotp(RFC_SECRET, { dir: dir(), now: () => at })).toBe(totp(RFC_SECRET, at));
  });

  it('waits for the next step when this step is already claimed, and returns its code', async () => {
    const d = dir();
    let clock = 90_000 - 100; // 100 ms before the step changes, so the wait is short
    const now = () => clock;
    const first = await unusedTotp(RFC_SECRET, { dir: d, now });
    const pending = unusedTotp(RFC_SECRET, { dir: d, now });
    clock = 90_100; // the next step has begun by the time the wait ends
    const second = await pending;
    expect(second).not.toBe(first);
    expect(second).toBe(totp(RFC_SECRET, 90_100));
  });

  it('never writes the secret itself to disk, only a hash of it', async () => {
    const { readdirSync } = await import('node:fs');
    const d = dir();
    await unusedTotp(RFC_SECRET, { dir: d, now: () => 59_000 });
    for (const name of readdirSync(d)) expect(name).not.toContain(RFC_SECRET);
  });
});

describe('unusedTotp — the claim register', () => {
  const dir = () => mkdtempSync(path.join(tmpdir(), 'totp-'));
  const OTHER_SECRET = 'JBSWY3DPEHPK3PXP';
  afterEach(() => vi.useRealTimers());

  it('keeps accounts apart: one account using a step does not block another', async () => {
    const d = dir();
    const at = 59_000;
    await unusedTotp(RFC_SECRET, { dir: d, now: () => at });
    expect(await unusedTotp(OTHER_SECRET, { dir: d, now: () => at })).toBe(totp(OTHER_SECRET, at));
  });

  it('honours a longer step: within one 60-second step the second claim must wait', async () => {
    const d = dir();
    vi.useFakeTimers();
    const now = () => Date.now();
    vi.setSystemTime(60_000 + 10_000); // 10 s into a 60 s step
    expect(await unusedTotp(RFC_SECRET, { dir: d, now, stepSeconds: 60 })).toBe(totp(RFC_SECRET, 70_000, 6, 60));
    let done = false;
    const pending = unusedTotp(RFC_SECRET, { dir: d, now, stepSeconds: 60 }).then((c) => ((done = true), c));
    await vi.advanceTimersByTimeAsync(30_000); // still inside the same 60 s step
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20_100); // past 120 s: the next step
    expect(await pending).toBe(totp(RFC_SECRET, 120_050, 6, 60));
  });

  it('waits until the next step and no longer', async () => {
    const d = dir();
    vi.useFakeTimers();
    vi.setSystemTime(89_000); // 1 s before a 30 s step ends
    const now = () => Date.now();
    await unusedTotp(RFC_SECRET, { dir: d, now });
    let done = false;
    const pending = unusedTotp(RFC_SECRET, { dir: d, now }).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1_000); // the step ends at 90 000, the wait adds 50 ms
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(60);
    await pending;
    expect(done).toBe(true);
  });

  it('gives up after three steps rather than waiting for ever', async () => {
    const d = dir();
    const at = 59_000;
    await unusedTotp(RFC_SECRET, { dir: d, now: () => at }); // claims the only step this clock shows
    await expect(unusedTotp(RFC_SECRET, { dir: d, now: () => at })).rejects.toThrow(
      /could not claim an unused one-time code/,
    );
  });

  it('reports a read-only register as the filesystem error it is, not as a taken code', async () => {
    const d = dir();
    chmodSync(d, 0o500); // the directory exists, but nothing can be created in it
    try {
      await expect(unusedTotp(RFC_SECRET, { dir: d, now: () => 59_000 })).rejects.toThrow(
        /could not write the one-time code register in .* \(EACCES\)/,
      );
    } finally {
      chmodSync(d, 0o700);
    }
  });

  it('reports a filesystem problem as itself, not as a taken code', async () => {
    const file = path.join(dir(), 'not-a-directory');
    writeFileSync(file, '');
    await expect(unusedTotp(RFC_SECRET, { dir: path.join(file, 'totp'), now: () => 59_000 })).rejects.toThrow(
      /EEXIST|ENOTDIR|not a directory/i,
    );
    await expect(unusedTotp(RFC_SECRET, { dir: path.join(file, 'totp'), now: () => 59_000 })).rejects.not.toThrow(
      /could not claim/,
    );
  });
});
