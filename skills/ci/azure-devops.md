# Azure DevOps Pipelines

Load this guide when: running the suite on Azure DevOps.

> Status: **a template. Certance has not yet run it on Azure DevOps.** `ci/azure-pipelines.yml`
> mirrors `.github/workflows/playwright.yml`, which runs on every pull request, and
> `unit/ci-templates.unit.test.ts` fails if the two drift apart: same gates, same npm scripts.

---

## Set it up

```bash
npm run init -- --url https://staging.your-app.com --login /login --ci azure
```

writes `azure-pipelines.yml` at the repository root from `ci/azure-pipelines.yml` (never over
an existing one). Or copy the file by hand. Then, in Azure DevOps, create a pipeline from it.

Two stages, as on GitHub:

- **checks**: lint, typecheck, docs, agent drift; then the integrity gate (pull requests),
  unit tests and mutation testing;
- **suite**: the suite, then the test summary, performance budgets, requirement traceability
  and the quality report (one HTML file, with its trend carried in the pipeline cache),
  published as the `quality-report` artifact even when tests fail.

## Sign-in secrets

**Pipelines → Library → Variable groups**: create one named `certance-lens` with the secrets
the application needs, marked **Secret**: `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`
(optionally `TEST_USER_TOTP_SECRET`), or `STORAGE_STATE_BASE64` from `npm run auth:capture`.
Allow the pipeline to use the group.

Azure exposes a secret to a script only through an explicit `env:` mapping, and it leaves an
undefined `$(NAME)` as literal text, which is not empty. So in the template's `npm test` step,
**delete the `env:` lines for any secret you did not define**, or the suite will believe a
test account exists. An application with no sign-in needs neither the group nor the mapping.

## Test results in the Tests tab

Playwright's built-in JUnit reporter is enough; no extra package. Add it for Azure only:

```typescript
// playwright.config.ts → reporter
...(process.env.TF_BUILD ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
```

and publish it after the suite with `PublishTestResults@2` (`testResultsFiles:
test-results/junit.xml`, `condition: always()`). The quality report remains the place a
customer reads; the Tests tab is for the engineers on Azure.

## Behind a corporate proxy

Self-hosted agents inside a corporate network: see `docs/CORPORATE_NETWORK.md`. Set the proxy
variables in the variable group, and put the test environment in `NO_PROXY`.
