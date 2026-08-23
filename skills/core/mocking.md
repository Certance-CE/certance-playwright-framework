# Network Mocking

Load this guide when: intercepting API calls, mocking third-party services,
or writing tests that must not make real external requests.

---

## Why mock at the network layer?

- **Speed** — no real network round trips; deterministic timing
- **Isolation** — tests don't depend on third-party uptime
- **Security** — no real API keys or payment tokens in tests
- **Edge cases** — simulate error responses that are hard to trigger in staging

---

## Implementation — the `network` fixture

`fixtures/network.fixture.ts` provides two things to every test:

- **`mockThirdParties`** (option, default **true**) — aborts requests to known
  analytics/telemetry/session-replay/ads hosts (`THIRD_PARTY_HOSTS`). Turn off per
  test with `test.use({ mockThirdParties: false })`.
- **`mock(pattern, handler)`** — a thin `page.route` wrapper for stubbing your own
  endpoints (fulfil / modify / abort).

```typescript
import { test, expect } from '../fixtures';

test('shows the empty state when the list API returns nothing', async ({ page, mock }) => {
  await mock('**/api/tasks', (route) => route.fulfill({ json: { tasks: [] } }));
  await page.goto('/app/list');
  await expect(page.getByText('No tasks yet')).toBeVisible();
});
```

See `framework-tests/foundation.spec.ts` for a runnable offline example.

### Fault injection — `degrade()` (prove graceful degradation)

`mockThirdParties` only _aborts_ a dependency (proves the app survives a **missing**
one). `degrade(pattern, opts)` injects the harder faults — **latency**, an **error
status**, or a **connection failure** — so a test can assert the app degrades
gracefully when a critical dependency is slow, rate-limited, or down.
Operational-resilience reviews expect exactly this evidence.

```typescript
test('checkout still works when the pricing API is slow', async ({ page, degrade }) => {
  await degrade('**/api/pricing', { delay: 3000 }); // 3s latency
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: 'Pay' })).toBeEnabled();
});

await degrade('**/api/inventory', { status: 503 }); // rate-limited / down
await degrade('**/api/inventory', { delay: 2000, status: 429 }); // slow AND throttled
await degrade('**/api/inventory', { abort: 'connectionrefused' }); // hard failure
```

Proven by `framework-tests/network.spec.ts` (503 · latency · connection failure · selective targeting).

---

## 1. Basic route interception (`page.route()`)

```typescript
// Intercept a specific URL pattern and return a stub response
await page.route('**/api/tasks', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: '1', title: 'Task 1', status: 'todo' },
      { id: '2', title: 'Task 2', status: 'in-progress' },
    ]),
  });
});
```

---

## 2. Modifying real responses

Intercept, call the real endpoint, then modify the response:

```typescript
await page.route('**/api/tasks', async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  // Inject an extra task without modifying the real backend
  json.push({ id: 'extra', title: 'Injected Task', status: 'todo' });
  await route.fulfill({ response, json });
});
```

---

## 3. Simulating errors

```typescript
// 500 Internal Server Error
await page.route('**/api/tasks', (route) => route.fulfill({ status: 500, body: 'Internal Server Error' }));

// Network failure (connection refused)
await page.route('**/api/tasks', (route) => route.abort());

// Slow response (test loading states)
await page.route('**/api/tasks', async (route) => {
  await new Promise((r) => setTimeout(r, 3000));
  await route.fulfill({ status: 200, json: [] });
});
```

---

## 4. Third-party services that must always be mocked

The following categories of external services must **always** be mocked —
never call real endpoints in automated tests:

| Service type       | Examples                     | Mock strategy                          |
| ------------------ | ---------------------------- | -------------------------------------- |
| Payment gateways   | Stripe, Braintree            | `page.route('**/api/stripe/**')`       |
| Identity providers | Auth0, Okta, Google SSO      | Skip redirect; inject storageState     |
| Analytics          | Amplitude, Mixpanel, Segment | `page.route('**/api.segment.io/**')`   |
| Email / SMS        | SendGrid, Twilio             | Mock outbound; intercept status calls  |
| Push notifications | FCM, APNS                    | Grant permission; don't send real push |
| CRMs               | Salesforce, HubSpot          | Mock API responses with static JSON    |

---

## 5. Using static JSON stubs

Store static API responses in `test-data/api-responses/`:

```typescript
import tasks from '../test-data/api-responses/tasks.json';

await page.route('**/api/tasks', (route) => route.fulfill({ status: 200, json: tasks }));
```

---

## 6. Asserting that an API call was made

```typescript
const [request] = await Promise.all([
  page.waitForRequest((req) => req.url().includes('/api/tasks') && req.method() === 'POST'),
  taskCreateModal.submit(),
]);

expect(request.postDataJSON()).toMatchObject({ title: 'My Task' });
```

---

## 7. Setting up mocks in a fixture

For mocks that apply to many scenarios, define them in a fixture:

```typescript
// fixtures/index.ts
export const test = base.extend<{ withMockedSearch: void }>({
  withMockedSearch: async ({ page }, use) => {
    await page.route('**/api/search**', (route) => route.fulfill({ status: 200, json: { results: [] } }));
    await use();
  },
});
```

Usage in step definitions:

```typescript
Given('the search API returns empty results', async ({ withMockedSearch }) => {
  // fixture already sets up the route
});
```
