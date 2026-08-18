# Assertions

Load this guide when: writing `expect()` statements, choosing the right
assertion type, or replacing fragile polling with web-first assertions.

---

## Web-first assertions — always use these

Web-first assertions automatically retry until the condition is met or the
timeout expires. They are the Playwright equivalent of `waitForElement`.

```typescript
// Visibility
await expect(locator).toBeVisible();
await expect(locator).not.toBeVisible();
await expect(locator).toBeHidden();

// Text content
await expect(locator).toHaveText('Exact text');
await expect(locator).toContainText('partial text');
await expect(locator).toHaveText(/regex pattern/);

// Input values
await expect(locator).toHaveValue('input value');
await expect(locator).toBeChecked();
await expect(locator).not.toBeChecked();

// Element state
await expect(locator).toBeDisabled();
await expect(locator).toBeEnabled();
await expect(locator).toBeFocused();

// Count
await expect(locator).toHaveCount(5);

// Attribute
await expect(locator).toHaveAttribute('aria-expanded', 'true');
await expect(locator).toHaveClass('active');

// Page-level
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveTitle('Dashboard — My App');
```

---

## Anti-patterns — never do these

```typescript
// ❌ Polling with waitForTimeout — always replace with web-first assertion
await page.waitForTimeout(2000);

// ❌ isVisible() without retry — race condition
const visible = await locator.isVisible();
expect(visible).toBe(true);

// ❌ evaluate() for visibility — bypasses Playwright retry
const display = await locator.evaluate((el) => el.style.display);
expect(display).not.toBe('none');
```

---

## Custom timeout for slow operations

```typescript
// Override default actionTimeout for a single assertion
await expect(locator).toBeVisible({ timeout: 30_000 });

// For authentication / navigation (slow redirects)
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });
```

---

## Soft assertions — collect all failures before stopping

```typescript
test('form validation', async ({ page }) => {
  await expect.soft(page.getByRole('alert', { name: 'Email required' })).toBeVisible();
  await expect.soft(page.getByRole('alert', { name: 'Password required' })).toBeVisible();
  // Test continues even if first assertion fails; all failures reported at end
});
```
