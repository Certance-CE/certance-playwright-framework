#!/usr/bin/env node
/**
 * Environment validation script for Certance framework
 * Verifies all required environment variables are properly configured
 * Run: node scripts/validate-env.js
 */

const { config } = require('dotenv');
// Import deobfuscate function (handle both .js and .ts)
let deobfuscate;
try {
  deobfuscate = require('../utils/obfuscation.ts').deobfuscate;
} catch {
  try {
    deobfuscate = require('../utils/obfuscation').deobfuscate;
  } catch {
    // Fallback deobfuscation for standalone operation
    deobfuscate = function (obfuscated) {
      if (obfuscated.startsWith('OBF:')) {
        return Buffer.from(obfuscated.substring(4), 'base64').toString('utf8');
      }
      return obfuscated;
    };
  }
}

config(); // Load .env file

const REQUIRED_VARS = ['BASE_URL', 'TEST_USER_EMAIL', 'TEST_USER_PASSWORD', 'APP_LIST_URL'];

const OPTIONAL_VARS = ['TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD', 'TEST_VIEWER_EMAIL', 'TEST_VIEWER_PASSWORD'];

function validateUrl(url, varName) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.error(`❌ ${varName}: Must use http:// or https:// protocol`);
      return false;
    }
    console.log(`✅ ${varName}: ${url}`);
    return true;
  } catch {
    console.error(`❌ ${varName}: Invalid URL format - ${url}`);
    return false;
  }
}

function validateEmail(email, varName) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error(`❌ ${varName}: Invalid email format - ${email}`);
    return false;
  }
  console.log(`✅ ${varName}: ${email}`);
  return true;
}

function validatePassword(password, varName) {
  if (!password.startsWith('OBF:')) {
    console.warn(`⚠️  ${varName}: Consider obfuscating password for security`);
    console.warn(`   Run: node -e "console.log(require('./utils/obfuscation').obfuscate('${password}'))"`);
    return true;
  }

  try {
    const decrypted = deobfuscate(password);
    if (decrypted.length < 6) {
      console.error(`❌ ${varName}: Password too short (minimum 6 characters)`);
      return false;
    }
    console.log(`✅ ${varName}: Obfuscated password (${decrypted.length} chars)`);
    return true;
  } catch {
    console.error(`❌ ${varName}: Invalid obfuscated password format`);
    return false;
  }
}

function main() {
  console.log('🔍 Validating Certance environment configuration...\n');

  let isValid = true;

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];

    if (!value) {
      console.error(`❌ ${varName}: Missing required environment variable`);
      isValid = false;
      continue;
    }

    // Validate specific formats
    if (varName.includes('URL')) {
      isValid = validateUrl(value, varName) && isValid;
    } else if (varName.includes('EMAIL')) {
      isValid = validateEmail(value, varName) && isValid;
    } else if (varName.includes('PASSWORD')) {
      isValid = validatePassword(value, varName) && isValid;
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  }

  // Check optional variables
  console.log('\n📋 Optional variables:');
  for (const varName of OPTIONAL_VARS) {
    const value = process.env[varName];
    if (value) {
      if (varName.includes('EMAIL')) {
        validateEmail(value, varName);
      } else if (varName.includes('PASSWORD')) {
        validatePassword(value, varName);
      }
    } else {
      console.log(`   ${varName}: Not set`);
    }
  }

  console.log('\n' + '='.repeat(50));

  if (isValid) {
    console.log('🎉 Environment configuration is valid!');
    console.log('\nNext steps:');
    console.log('  npm run bdd:test     # Run the BDD suite');
    process.exit(0);
  } else {
    console.log('❌ Environment configuration has errors');
    console.log('\nTo fix:');
    console.log('  1. Copy .env.example to .env');
    console.log('  2. Edit .env with your staging environment details');
    console.log('  3. Run this script again to validate');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateUrl, validateEmail, validatePassword };
