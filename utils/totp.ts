import { createHash, createHmac } from 'node:crypto';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';

/**
 * One-time passcodes for test accounts that sign in with an authenticator app (TOTP,
 * RFC 6238: HMAC-SHA1, 30-second steps, 6 digits, which is what authenticator apps and most
 * identity providers use). The secret is the base32 string shown when the authenticator is
 * set up. It belongs in TEST_USER_TOTP_SECRET (.env locally, a secret in CI), never in the
 * repository: whoever holds it can produce the account's codes.
 *
 * Dependency-free, so it can be read and checked in one sitting.
 */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode an RFC 4648 base32 string; spaces, dashes and padding are ignored, case is not. */
export function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/[\s=-]/g, '').toUpperCase();
  let bits = '';
  for (const [i, char] of [...clean].entries()) {
    const value = BASE32.indexOf(char);
    // The position, never the character: this message must not print any part of a secret.
    if (value === -1) throw new Error(`not a base32 secret: character ${i + 1} is not A–Z or 2–7`);
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  if (!bytes.length) throw new Error('not a base32 secret: it is empty');
  return Buffer.from(bytes);
}

/** The TOTP code for `secret` at time `at` (milliseconds since the epoch). */
export function totp(secret: string, at: number = Date.now(), digits = 6, stepSeconds = 30): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / stepSeconds)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

/**
 * A code nobody in this run has used yet. Identity providers reject a code used twice
 * (replay protection: measured on the reference app, "This totp passcode has already been
 * used"), and a code only changes every 30 seconds, so a setup sign-in and a sign-in scenario
 * moments apart would otherwise collide. Each 30-second step is claimed once, across every
 * test worker, by atomically creating a marker file; if the current step is taken, this
 * waits for the next one. That wait is the protocol's, not a guess: at most one step.
 */
export async function unusedTotp(
  secret: string,
  { dir = 'test-data/.auth/totp', stepSeconds = 30, now = () => Date.now() } = {},
): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const account = createHash('sha256').update(secret).digest('hex').slice(0, 12); // never the secret itself
  for (let attempt = 0; attempt < 3; attempt++) {
    const at = now();
    const step = Math.floor(at / 1000 / stepSeconds);
    try {
      closeSync(openSync(join(dir, `${account}-${step}`), 'wx')); // fails if this step is claimed
      return totp(secret, at, 6, stepSeconds);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      // Our own message: the error's file path is derived from the secret's hash.
      if (code !== 'EEXIST')
        throw new Error(`could not write the one-time code register in ${dir} (${code})`, { cause: e });
      const untilNextStep = (step + 1) * stepSeconds * 1000 - now() + 50;
      await new Promise((resolve) => setTimeout(resolve, Math.max(untilNextStep, 0)));
    }
  }
  throw new Error('could not claim an unused one-time code in three steps');
}
