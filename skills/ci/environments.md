# Environment Configuration

Load this guide when: managing multiple deployment environments (staging, UAT,
production-mirror), or configuring the suite for a new environment.

---

## Environment variables

All environment-specific configuration uses `.env` files loaded by `dotenv`
in `playwright.config.ts`. Never hard-code environment values.

```
.env            — local overrides (gitignored)
.env.example    — committed template (no secrets, always up to date)
```

---

## Environment-specific `.env` files (optional)

For suites that run against multiple environments:

```
.env.staging    — staging environment
.env.uat        — user acceptance testing
.env.prod-mirror — production clone (read-only tests)
```

Load a specific env file:

```bash
ENV=staging npx dotenv -e .env.staging -- npx playwright test
```

Or using a custom script in `package.json`:

```json
{
  "scripts": {
    "test:staging": "dotenv -e .env.staging -- npx playwright test",
    "test:uat": "dotenv -e .env.uat -- npx playwright test"
  }
}
```

---

## Fail fast on missing configuration

Read environment variables in `playwright.config.ts`, not scattered through tests, and give
each one a sensible default or a clear error. Configuration problems should surface when the
run starts, not halfway through a scenario:

```typescript
// playwright.config.ts
const baseURL = process.env.BASE_URL || 'https://demo.playwright.dev';
```

Never inline a secret in a test or commit one to the repo — inject credentials from your
platform's secret manager and let the auth setup exchange them for a `storageState` artifact
(see `skills/core/auth.md`).

---

## Environment registry

Document all environments for the project in your project docs (for example,
a table in `docs/DEVELOPER_GUIDE.md`):

```markdown
| Environment | URL                         | Used for               | Auth type         |
| ----------- | --------------------------- | ---------------------- | ----------------- |
| Staging     | https://staging.example.com | Developer + QA testing | Username/password |
| UAT         | https://uat.example.com     | Stakeholder acceptance | Username/password |
| Prod-mirror | https://mirror.example.com  | Read-only smoke tests  | SSO restricted    |
```

---

## CI secrets per environment

For GitHub Actions, create separate environments and secrets per deployment:

1. Go to **Settings → Environments**
2. Create: `staging`, `uat`
3. Add secrets to each environment
4. Reference in workflow:

```yaml
jobs:
  test:
    environment: staging
    env:
      BASE_URL: ${{ secrets.BASE_URL }}
```
