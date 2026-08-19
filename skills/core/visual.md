# Visual Regression Testing

> Status: **Implemented** — `expect(page).toHaveScreenshot()` with defaults in
> `playwright.config.ts` (`expect.toHaveScreenshot`) + `stabilize()` in `utils/visual.ts`.

Load this guide when: adding visual screenshot comparison to the suite.

## Implementation

Global defaults (animations disabled, `scale: 'css'`, `maxDiffPixelRatio: 0.01`)
live in `playwright.config.ts`. Before a snapshot, call `stabilize(page)`
(`utils/visual.ts`) to kill animations/transitions/caret, and `mask` any
genuinely dynamic regions.

```typescript
import { test, expect } from '../fixtures';
import { stabilize } from '../utils/visual';

test('dashboard looks right', async ({ page }) => {
  await page.goto('/dashboard');
  await stabilize(page);
  await expect(page).toHaveScreenshot('dashboard.png', {
    mask: [page.getByRole('time')], // hide live timestamps
  });
});
```

**Baselines are per-platform** and are _not_ committed by the framework — generate
yours once and commit them:

```bash
npm run test:visual -- --update-snapshots
```

Put visual specs in `tests/visual/` as `*.visual.spec.ts` on the `chromium` project, and
keep them **out** of the smoke and regression suites. Give them a dedicated job, and
generate baselines on the CI platform (Linux) rather than on a developer machine —
a baseline captured on macOS will never match the one CI compares against.

---

---

## Recommended approach: Playwright built-in snapshots

```typescript
// Capture and compare a full-page screenshot
await expect(page).toHaveScreenshot('dashboard.png');

// Compare a specific element
await expect(page.getByRole('main')).toHaveScreenshot('main-content.png');
```

First run generates the baseline. Subsequent runs diff against it.
Update baselines with: `npx playwright test --update-snapshots`

---

## Threshold configuration

```typescript
// playwright.config.ts
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.01,  // allow 1% pixel difference
  },
},
```

---

## CI considerations

- Store baseline screenshots in version control (`tests/__snapshots__/`)
- Regenerate baselines when intentional UI changes are deployed
- Mask dynamic regions (timestamps, avatars) with `mask` option:

```typescript
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [page.getByTestId('user-avatar'), page.getByRole('timer')],
});
```

---

## Alternative: Percy / Applitools

For advanced visual diffing and review workflows, integrate Percy
(`@percy/playwright`) or Applitools (`@applitools/eyes-playwright`).
