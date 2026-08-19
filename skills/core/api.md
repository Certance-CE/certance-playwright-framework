# API Testing with Playwright Request Context

> Status: **Implemented** — the `api` fixture (`fixtures/api.fixture.ts`).

Load this guide when: writing API-only tests, using the API to set up test
state, or cleaning up after UI tests.

---

## Implementation — the `api` fixture

`fixtures/api.fixture.ts` provides an authenticated `APIRequestContext` to every
test as `api`, configured from `APP_API_URL` (or `BASE_URL`) + `APP_API_TOKEN`
(see `.env.example`).

```typescript
import { test, expect } from '../fixtures';

// Seed via API (fast, deterministic) → assert via UI:
test('a task created via API appears in the list', async ({ api, page, data }) => {
  const res = await api.post('/api/v2/list/{id}/task', { data: { name: data.taskName() } });
  const { id } = await res.json();
  await page.goto(process.env.APP_LIST_URL!);
  await expect(page.getByRole('link', { name: /Automated Task/ })).toBeVisible();
  await api.delete(`/api/v2/task/${id}`); // teardown
});
```

API-only contract tests belong in `tests/api/` as `*.contract.spec.ts`, using the
`chromium` project. Gate them on `APP_API_TOKEN` so they skip cleanly when no token is
configured. The framework ships the `api` fixture and the schema validator; the specs
themselves are yours to add for the API under test.

## Schema validation — catch provider drift (`utils/contract.ts`)

`expectSchema(response, schema)` asserts a response is 2xx **and** that its JSON
body matches a Zod schema — so a provider that drops a field, changes a type, or
adds an unannounced enum value **fails the test** with a precise message instead of
silently passing. This turns the `api` fixture into a provider-drift detector.

```typescript
import { test } from '../fixtures';
import { expectSchema } from '../utils/contract';
import { z } from 'zod';

const Task = z.object({ id: z.string(), name: z.string(), status: z.enum(['todo', 'done']) });

test('the task endpoint holds its contract', async ({ api }) => {
  const res = await api.get('/api/v2/task/123');
  const task = await expectSchema(res, Task, 'GET /task'); // typed + validated
  // task.status is now type-safe
});
```

Schemas are plain Zod — hand-write them, or **generate from the provider's OpenAPI**
(e.g. `openapi-zod-client`) so the contract tracks the spec. `validateSchema(body, schema)`
is the pure variant for a value you already have. Proven by `tests/contract.spec.ts`.

## Running in CI

Give contract tests their own CI job so a provider-side change is attributable at a glance, and gate that job on the API token being present.
It needs **no browser auth** — just the API endpoint + token, configured per repo:

| Value           | Where                                                                    | Why                                                              |
| --------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `APP_API_TOKEN` | **Secret** — Settings → Secrets and variables → Actions → New **secret** | sensitive credential                                             |
| `APP_API_URL`   | **Variable** — same page → **Variables** tab                             | not sensitive; keeps the workflow app-agnostic (golden rule #12) |

```bash
# CLI alternative (run these yourself; the token never leaves your machine):
gh secret set APP_API_TOKEN          # prompts for the value
gh variable set APP_API_URL --body "https://api.your-app.com/"
```

The API tests **skip** (green) until `APP_API_TOKEN` exists, so the job is safe to
merge before the secret is set — it activates automatically once it is.

---

## Using Playwright's request context

Playwright's built-in `request` fixture makes authenticated API calls without
launching a browser. Use this for test data setup/teardown.

```typescript
test('creates a task via API and verifies in UI', async ({ page, request }) => {
  // Setup: create task via API
  const response = await request.post(`${process.env.BASE_URL}api/tasks`, {
    headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
    data: { title: 'API-created task', status: 'todo' },
  });
  expect(response.ok()).toBeTruthy();
  const task = await response.json();

  // Verify: task appears in the UI
  await page.goto(process.env.APP_LIST_URL!);
  await expect(page.getByRole('link', { name: task.title })).toBeVisible();
});
```

---

## Reusable API client fixture

```typescript
// fixtures/index.ts — add an apiRequest fixture
import { APIRequestContext } from '@playwright/test';

type PageFixtures = {
  // ...existing
  apiRequest: APIRequestContext;
};

export const test = base.extend<PageFixtures>({
  apiRequest: async ({ request }, use) => {
    await request.storageState(); // reuse saved auth cookies for API calls
    await use(request);
  },
});
```

---

## Isolating API tests from UI tests

Keep pure API tests in `tests/api/` and tag them:

```typescript
// tests/api/tasks-api.spec.ts
test.describe('@api', () => {
  test('GET /api/tasks returns list', async ({ request }) => {
    const response = await request.get(`${process.env.BASE_URL}api/tasks`);
    expect(response.status()).toBe(200);
    const tasks = await response.json();
    expect(Array.isArray(tasks)).toBe(true);
  });
});
```

Run API tests only: `npx playwright test --grep @api --project=chromium`

---

## API client utility

For complex API operations, create a typed client in `utils/api-client.ts`:

```typescript
// utils/api-client.ts
export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
  ) {}

  async createTask(data: { title: string; status?: string }) {
    const res = await this.request.post(`${this.baseUrl}api/tasks`, { data });
    expect(res.ok()).toBeTruthy();
    return res.json() as Promise<{ id: string; title: string }>;
  }

  async deleteTask(id: string) {
    const res = await this.request.delete(`${this.baseUrl}api/tasks/${id}`);
    expect(res.ok()).toBeTruthy();
  }
}
```
