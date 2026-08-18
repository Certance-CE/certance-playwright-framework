# Sharding Strategy

Load this guide when: splitting 200+ tests across parallel CI workers to
reduce total execution time.

---

## When to shard

| Suite size    | Recommended approach                             |
| ------------- | ------------------------------------------------ |
| < 100 tests   | Single run, `workers: 4`                         |
| 100–500 tests | Single run, `workers: 8` + `fullyParallel: true` |
| 500+ tests    | Sharding across CI matrix jobs                   |

---

## Single-project sharding

```bash
# Split 500 tests into 4 shards; run each on a separate CI job
npx playwright test --shard=1/4   # job 1: tests 1–125
npx playwright test --shard=2/4   # job 2: tests 126–250
npx playwright test --shard=3/4   # job 3: tests 251–375
npx playwright test --shard=4/4   # job 4: tests 376–500
```

---

## GitHub Actions matrix sharding

```yaml
strategy:
  fail-fast: false
  matrix:
    shardIndex: [1, 2, 3, 4]
    shardTotal: [4]

steps:
  - name: Run tests (shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }})
    run: >
      npx playwright test
      --project=bdd:chromium
      --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}

  - name: Upload blob report
    uses: actions/upload-artifact@v4
    if: always()
    with:
      name: blob-report-${{ matrix.shardIndex }}
      path: blob-report/
```

---

## Merging shard reports

After all shards complete, merge their blob reports into one HTML report:

```yaml
# New job: merge-reports
needs: [test-shards]
steps:
  - name: Download all blob reports
    uses: actions/download-artifact@v4
    with:
      path: all-blob-reports
      pattern: blob-report-*
      merge-multiple: true

  - name: Merge reports
    run: npx playwright merge-reports --reporter html ./all-blob-reports

  - name: Upload merged report
    uses: actions/upload-artifact@v4
    with:
      name: playwright-report
      path: playwright-report/
```

Configure blob reporter in `playwright.config.ts`:

```typescript
reporter: [
  process.env.CI ? ['blob'] : ['html'],
  ['json', { outputFile: 'test-results/results.json' }],
],
```
