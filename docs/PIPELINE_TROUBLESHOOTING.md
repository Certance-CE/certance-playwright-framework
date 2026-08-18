# GitHub Actions Failure Checklist

When the Playwright pipeline fails, check these items in order:

## 1. Repository Secrets ✅

Go to `https://github.com/stepantzov/Certance/settings/secrets/actions`

Verify these secrets exist and have valid values:

- [ ] `BASE_URL` — Staging environment URL (https://...)
- [ ] `TEST_USER_EMAIL` — Test user email address
- [ ] `TEST_USER_PASSWORD` — Obfuscated password (OBF:...)
- [ ] `APP_LIST_URL` — Main app URL after login

## 2. Staging Environment ✅

- [ ] Staging environment is running and accessible
- [ ] Test user account exists with correct credentials
- [ ] Application loads properly at BASE_URL
- [ ] Authentication flow works as expected

## 3. Test User Setup ✅

- [ ] User has appropriate permissions for test scenarios
- [ ] Login redirects to expected location (APP_LIST_URL)
- [ ] User can see "Create task" button (required by seed test)

## 4. Local Validation ✅

Test locally before pushing to GitHub:

```bash
# Validate environment configuration
npm run validate:env

# Test authentication
npm run test:seed

# Run smoke tests
npm run bdd:test
```

## 5. Common Issues 🔧

**Connection Refused:**

- Check BASE_URL secret is set correctly in GitHub
- Verify staging environment is running

**Authentication Failed:**

- Verify TEST_USER_EMAIL/PASSWORD secrets match staging user
- Check password is properly obfuscated: `OBF:...`
- Ensure user exists in staging environment

**Element Not Found:**

- Application UI may have changed
- Update selectors in seed test if needed
- Check "Create task" button exists after login

## Quick Commands

```bash
# Generate obfuscated password
node -e "console.log(require('./utils/obfuscation').obfuscate('plain-password'))"

# Test seed locally
npx playwright test tests/seed.spec.ts --headed

# View CI traces (after downloading from failed run)
npx playwright show-trace path/to/trace.zip
```
