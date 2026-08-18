# Parallel Execution and Sharding

Load this guide when: configuring workers, sharding large suites, or
optimising CI execution time.

---

## Default parallelism

`playwright.config.ts` runs tests in parallel by default:

```typescript
fullyParallel: true,            // tests within a file run in parallel
workers: process.env.CI ? 4 : undefined,  // CI: 4 workers; local: CPU count
```

Each worker gets its own browser context. Tests must be independent —
no shared mutable state between tests.

---

## Sharding — splitting across CI jobs

For suites with 200+ tests, split across multiple CI jobs:

```typescript
// Run shard 1 of 4
npx playwright test --shard=1/4

// Run shard 2 of 4
npx playwright test --shard=2/4
```

GitHub Actions matrix example:

```yaml
strategy:
  matrix:
    shardIndex: [1, 2, 3, 4]
    shardTotal: [4]
steps:
  - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
```

Merge shard reports into one HTML report afterwards:

```bash
npx playwright merge-reports --reporter html ./all-blob-reports
```

---

## Worker count guidelines

| Suite size    | Local workers | CI workers        |
| ------------- | ------------- | ----------------- |
| < 50 tests    | default (CPU) | 2                 |
| 50–200 tests  | default (CPU) | 4                 |
| 200–500 tests | default (CPU) | 4 + sharding      |
| 500+ tests    | default (CPU) | matrix + sharding |

---

## Tests that cannot run in parallel

Some tests modify shared state (e.g., changing a global setting). Serialize them:

```typescript
test.describe.configure({ mode: 'serial' });

test('step 1', async ({ page }) => { ... });
test('step 2 depends on step 1', async ({ page }) => { ... });
```

Use `mode: 'serial'` sparingly — it defeats the purpose of parallel execution.
Prefer API-based setup and teardown to avoid shared state.
