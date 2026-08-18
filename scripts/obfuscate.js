#!/usr/bin/env node
/**
 * Generate obfuscated password for .env file
 * Usage: node scripts/obfuscate.js "your-password-here"
 */

// Import from utils/obfuscation.ts compiled to JS
const obfuscate = (plaintext) => {
  const encoded = Buffer.from(plaintext, 'utf8').toString('base64');
  return `OBF:${encoded}`;
};

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/obfuscate.js "your-password-here"');
  process.exit(1);
}

console.log('Obfuscated password for .env file:');
console.log(obfuscate(password));
