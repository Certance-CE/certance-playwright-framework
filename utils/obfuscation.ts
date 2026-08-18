/**
 * Simple obfuscation utilities for test credentials.
 *
 * NOTE: This is obfuscation, not encryption. It prevents casual viewing
 * of credentials in .env files but is not cryptographically secure.
 * Use proper secret management (Azure Key Vault, AWS Secrets Manager)
 * for production systems.
 *
 * Usage:
 *   // Generate obfuscated value for .env file
 *   console.log(obfuscate('my-secret-password'));
 *
 *   // In application code (handled automatically by env.ts)
 *   const password = deobfuscate(process.env.TEST_USER_PASSWORD_OBFUSCATED);
 */

/**
 * Obfuscate a string using Base64 encoding with prefix.
 * Prefix helps identify obfuscated values in .env files.
 */
export function obfuscate(plaintext: string): string {
  const encoded = Buffer.from(plaintext, 'utf8').toString('base64');
  return `OBF:${encoded}`;
}

/**
 * Deobfuscate a string, handling both plain and obfuscated formats.
 * This allows gradual migration - plain values still work.
 */
export function deobfuscate(value: string): string {
  if (value.startsWith('OBF:')) {
    const encoded = value.substring(4);
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  // Return as-is if not obfuscated (for backward compatibility)
  return value;
}

/**
 * CLI utility for generating obfuscated values.
 * Run: node -e "console.log(require('./utils/obfuscation').obfuscate('your-password'))"
 */
export function generateObfuscated(plaintext: string): void {
  console.log(`Original: ${plaintext}`);
  console.log(`Obfuscated: ${obfuscate(plaintext)}`);
  console.log(`Verification: ${deobfuscate(obfuscate(plaintext))}`);
}
