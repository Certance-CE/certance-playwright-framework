# Session Management

Load this guide when: managing multiple authenticated browser sessions,
running tests that require different concurrent users, or debugging session
persistence issues.

---

## Multiple sessions in one test

Use `browser.newContext()` to create independent sessions:

```typescript
test('two users collaborate on a task', async ({ browser }) => {
  // User A — authenticated via storageState
  const contextA = await browser.newContext({
    storageState: 'test-data/.auth/user.json',
  });
  const pageA = await contextA.newPage();

  // User B — admin role
  const contextB = await browser.newContext({
    storageState: 'test-data/.auth/admin.json',
  });
  const pageB = await contextB.newPage();

  // Interact with both sessions...

  await contextA.close();
  await contextB.close();
});
```

---

## Session isolation

Each Playwright test worker gets an isolated browser context by default.
Tests never share cookies, localStorage, or session tokens unless you
explicitly set `storageState`.

```typescript
// playwright.config.ts projects that share auth state:
{ name: 'bdd:chromium', use: { storageState: 'test-data/.auth/user.json' } }

// Projects that start fresh (unauthenticated):
{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }
```

---

## Debugging session issues

```typescript
// Dump current cookies and localStorage for inspection
const state = await page.context().storageState();
console.log(JSON.stringify(state, null, 2));

// Check if session has expired
await page.goto(process.env.BASE_URL!);
const isLoggedIn = await page.getByRole('button', { name: 'Create task' }).isVisible();
console.log('Session valid:', isLoggedIn);
```
