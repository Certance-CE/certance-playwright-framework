# GitLab CI

Load this guide when: running the suite on GitLab.

> Status: **a template. Certance has not yet run it on GitLab.** `ci/gitlab-ci.yml` mirrors
> `.github/workflows/playwright.yml`, which runs on every pull request, and
> `unit/ci-templates.unit.test.ts` fails if the two drift apart: same gates, same npm scripts.

---

## Set it up

```bash
npm run init -- --url https://staging.your-app.com --login /login --ci gitlab
```

writes `.gitlab-ci.yml` at the repository root from `ci/gitlab-ci.yml` (never over an existing
one). It runs on merge requests and on the default branch, in the `node:24` image:

- **checks**: `lint` (lint, typecheck, docs, agent drift) and `unit` (the integrity gate on
  merge requests, unit tests, mutation testing);
- **suite**: the suite, then in `after_script` (which runs even when tests fail) the test
  summary, performance budgets, requirement traceability and the quality report. The report's
  trend is carried in the cache, per branch with the default branch as the fallback; the
  report and the other outputs are kept as artifacts for 30 days.

## Sign-in secrets

**Settings → CI/CD → Variables**: add the secrets the application needs, **masked**:
`TEST_USER_EMAIL` and `TEST_USER_PASSWORD` (optionally `TEST_USER_TOTP_SECRET`), or
`STORAGE_STATE_BASE64` from `npm run auth:capture`. GitLab passes them to every job as
environment variables, and one you do not define is simply absent: nothing in the template
needs editing. Mark them **protected** if only protected branches should sign in.

## Behind a corporate proxy

Self-hosted runners inside a corporate network: see `docs/CORPORATE_NETWORK.md`. Set the proxy
variables as CI/CD variables, and put the test environment in `NO_PROXY`. On a runner with no
internet access, use Playwright's image (`mcr.microsoft.com/playwright`, matching the version in
`package-lock.json`) instead of `node:24` plus `playwright install`.
