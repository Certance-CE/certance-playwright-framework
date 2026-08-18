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

Visual specs live in `tests/visual/*.visual.spec.ts`, run via `npm run test:visual`
(the `chromium` project). They are **not** in the CI smoke/regression suites — wire
them into a dedicated job once baselines exist for the CI platform (Linux). See
`tests/visual/example.visual.spec.ts` for a runnable offline example.

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

For enterprise visual testing with advanced diffing and review workflows,
integrate Percy (`@percy/playwright`) or Applitools (`@applitools/eyes-playwright`).
Contact Certance Advisory for advanced visual testing setup.
