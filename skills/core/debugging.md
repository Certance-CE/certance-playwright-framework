# Debugging and Tracing

Load this guide when: diagnosing test failures, investigating flaky tests,
or reviewing trace output from CI.

---

## The debugging toolkit

| Tool                       | When to use                     | Command                               |
| -------------------------- | ------------------------------- | ------------------------------------- |
| Playwright UI mode         | Interactive run + timeline view | `npm run test:ui`                     |
| Inspector mode             | Step through actions one by one | `npm run test:debug`                  |
| Trace viewer               | Post-failure investigation      | `npx playwright show-trace trace.zip` |
| `console.log` + `--headed` | Quick local check               | `npm run test:headed`                 |

---

## Trace files

Traces are captured automatically on first retry (`trace: 'on-first-retry'`
in `playwright.config.ts`). In CI, they are included in the HTML report.

To capture a trace for a specific test regardless of failure:

```bash
npx playwright test --trace=on tests/my.spec.ts
```

Open the trace viewer:

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

The trace shows: DOM snapshots, network requests, console logs, screenshots
at every action step.

---

## Common failure patterns and fixes

| Symptom                                       | Cause                           | Fix                                                                          |
| --------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `Timeout waiting for element`                 | Element not rendered yet        | Check if there's a loading state; assert on loading-complete indicator first |
| `strict mode: locator resolved to N elements` | Ambiguous locator               | Scope to a container; use `first()` only with a comment explaining why       |
| `Element is outside of the viewport`          | Scroll needed                   | Use `locator.scrollIntoViewIfNeeded()` before action                         |
| `Navigation failed`                           | Redirect loop or 404            | Check `BASE_URL` env var; verify staging environment is up                   |
| `storageState not found`                      | Seed not run                    | Re-run the setup project (`npx playwright test --project=setup`)             |
| Passes locally, fails in CI                   | Headless / resource differences | Increase `actionTimeout`; remove any `waitForTimeout` calls                  |

---

## Debugging a specific step

```typescript
// Pause execution and open the inspector at a specific point
await page.pause();

// Take a screenshot at any point
await page.screenshot({ path: 'debug-screenshot.png' });

// Log the ARIA tree to understand available locators
const snapshot = await page.accessibility.snapshot();
console.log(JSON.stringify(snapshot, null, 2));
```

---

## Flaky test investigation checklist

1. Run with `--repeat-each=10` to reproduce intermittent failure
2. Open trace from a failed run
3. Look for: timing assumptions, `waitForTimeout`, position-dependent clicks
4. Check if the element is animated (add assertion before interaction)
5. Check network: is there a slow API call the test doesn't wait for?
6. Run the Healer agent if the locator itself is the problem
