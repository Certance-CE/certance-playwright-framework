# GitHub Actions — CI Pipeline Guide

Load this guide when: setting up CI for a new project, modifying the pipeline,
or debugging CI failures.

---

## Pipeline overview

The framework ships with two GitHub Actions workflows:

| File                      | Trigger                               | Purpose                                 | Target time |
| ------------------------- | ------------------------------------- | --------------------------------------- | ----------- |
| `playwright.yml`          | Every push / PR to `main`, `develop`  | Smoke tests on Chromium                 | < 10 min    |
| (regression in same file) | Nightly `schedule` or manual dispatch | Full regression on Chromium, sharded 4× | < 30 min    |

---

## Required GitHub Actions Secrets

When the app under test requires authentication, set these in the project repository under **Settings → Secrets and variables → Actions**:

| Secret name          | Description                                    |
| -------------------- | ---------------------------------------------- |
| `BASE_URL`           | Base URL of staging / test environment         |
| `TEST_USER_EMAIL`    | Test user email                                |
| `TEST_USER_PASSWORD` | Test user password                             |
| `APP_LIST_URL`       | Primary post-login URL (list, dashboard, etc.) |

Optional (for multi-role suites):
| `TEST_ADMIN_EMAIL` | Admin user email |
| `TEST_ADMIN_PASSWORD` | Admin user password |

---

## Workflow jobs

### Job 1: `seed`

Runs first. Authenticates with the application and saves `user.json`.
Uploads the file as a GitHub Actions artefact shared with downstream jobs.

```yaml
- name: Run seed spec (save storageState)
  run: npm run test:seed
```

### Job 2: `bdd-smoke` (every PR)

Downloads the auth artefact, generates BDD specs, runs `@smoke` tagged
tests on Chromium. Blocks merge if any smoke test fails.

```yaml
- name: Run smoke tests
  run: npx playwright test --project=bdd:chromium --grep @smoke
```

### Job 3: `bdd-regression` (nightly schedule or manual dispatch)

Runs the full regression suite on Chromium, **sharded 4 ways** for parallelism.
Triggers on a `schedule` event or a manual **Run workflow** (`workflow_dispatch`).
Uses `--grep-invert "@wip|@flaky"` — `@wip` is unfinished work; `@flaky` is the
quarantine lane (kept out of the gate). A `merge-regression-reports` job then
recombines the shard blob reports into one HTML report.

```yaml
matrix:
  shard: [1, 2, 3, 4]
# run: npx playwright test --project=bdd:chromium --grep-invert "@wip|@flaky" --shard=${{ matrix.shard }}/4
```

---

## Adding a new project repo

1. Copy `.github/workflows/playwright.yml` to the project repo
2. Add secrets if the app requires auth (see Required Secrets above)
3. Adjust the `branches` trigger to match the project's branching model
4. Run a manual workflow dispatch to verify the pipeline

---

## Viewing test reports

HTML reports are uploaded as GitHub Actions artefacts after every run.

- Navigate to **Actions → [workflow run] → Artifacts**
- Download `playwright-report-smoke` (PR runs) or `playwright-report-bdd:*` (nightly)
- Unzip and open `index.html` in a browser

For a persistent report dashboard, consider deploying the HTML report to
GitHub Pages or an S3 bucket after each nightly run.

---

## Playwright Docker image

All jobs use the official Playwright Docker image for browser version
consistency between local and CI environments:

```yaml
container:
  image: mcr.microsoft.com/playwright:v1.52.0-noble
```

Update the image tag whenever you upgrade `@playwright/test`. The image tag
format is: `mcr.microsoft.com/playwright:v{version}-noble`.

---

## Parallelism and sharding

The regression job is **sharded 4 ways** across runners (`matrix.shard`), each
running `--shard=i/4`. Each shard runs with the `blob` reporter (`PW_BLOB=1`), and
`merge-regression-reports` recombines them into one HTML report with
`npx playwright merge-reports`.

Two tunables — sized to the app's rate limits, since all shards share one test account:

| Knob             | Where                                                         | Default | Effect                                  |
| ---------------- | ------------------------------------------------------------- | ------- | --------------------------------------- |
| **shard count**  | `matrix.shard` in `bdd-regression`                            | 4       | horizontal scale — one runner per shard |
| **`PW_WORKERS`** | repo variable (Settings → Variables) → `playwright.config.ts` | 1       | workers **per shard** (vertical)        |

Total concurrent sessions against the account = shards × `PW_WORKERS`. Start low;
raise as the app tolerates it. Locally, `fullyParallel` is on and workers are
unset (Playwright auto-detects); the `PW_WORKERS`/single-worker path is CI-only.

To scale a very large suite, add more entries to `matrix.shard` and bump the
`/N` divisor to match.

---

## Troubleshooting CI failures

| Failure symptom                | Likely cause                            | Fix                                                                |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------------ |
| `seed` job times out           | Login form locators broken              | Update `seed.spec.ts` locators                                     |
| `user.json` not found          | Artefact upload failed                  | Check seed job logs                                                |
| Tests pass locally, fail in CI | Missing env secrets                     | Add to GitHub Secrets                                              |
| Browser launch error           | Wrong Playwright image tag              | Match image version to `@playwright/test` version                  |
| `bdd:gen` fails                | Feature file syntax error               | Validate Gherkin YAML                                              |
| Flaky tests in CI only         | Timing differences, resource contention | Increase `actionTimeout`, check for `waitForTimeout` anti-patterns |
