# CI/CD Setup Guide

## GitHub Actions Configuration

### Required Repository Secrets

Configure these secrets in your GitHub repository at `Settings > Secrets and variables > Actions`:

| Secret Name          | Description              | Example                                        |
| -------------------- | ------------------------ | ---------------------------------------------- |
| `BASE_URL`           | Staging environment URL  | `https://staging.your-app.com/`                |
| `TEST_USER_EMAIL`    | Test user email          | `qa-robot@yourdomain.com`                      |
| `TEST_USER_PASSWORD` | Obfuscated password      | `OBF:cmVwbGFjZS13aXRoLW9iZnVzY2F0ZWQtc2VjcmV0` |
| `APP_LIST_URL`       | Main app URL after login | `https://staging.your-app.com/app/main`        |

### Password Obfuscation

To obfuscate passwords for secure storage:

```bash
# In your project root
node -e "console.log(require('./utils/obfuscation').obfuscate('your-plain-password'))"
```

### Staging Environment Requirements

The Certance framework requires an external staging environment because:

- Tests need a stable, consistent environment
- Authentication state must persist across test runs
- The application should match production configuration

**Staging environment must have:**

- Test user account with appropriate permissions
- Stable data for predictable test outcomes
- Same authentication flow as production
- HTTPS enabled for security

### Troubleshooting Failed Runs

**Common Issues:**

1. **`net::ERR_CONNECTION_REFUSED`**
   - Check BASE_URL secret is set correctly
   - Verify staging environment is running and accessible

2. **Authentication failures**
   - Verify TEST_USER_EMAIL/PASSWORD secrets
   - Check user exists in staging environment
   - Ensure password is properly obfuscated

3. **Missing environment variables**
   - All secrets must be configured in GitHub repository
   - Secrets are case-sensitive

**Local Testing:**

```bash
# Test with staging environment
cp .env.example .env
# Edit .env with staging values

# Validate configuration
npm run validate:env

# Test authentication
npm run test:seed

# Verify authentication works
npx playwright test tests/seed.spec.ts --headed
```

### Manual Debugging

If the pipeline fails:

1. **Download artifacts** from the failed run:
   - `playwright-traces-smoke` — contains trace files
   - `playwright-report-*` — contains HTML test reports

2. **View trace locally:**

   ```bash
   npx playwright show-trace path/to/trace.zip
   ```

3. **Check environment in CI logs** — verify all secrets are populated (values will be masked)
