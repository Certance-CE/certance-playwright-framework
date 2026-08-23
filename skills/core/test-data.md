# Test Data management

Load this guide when: generating test data, managing seeded records,
or dealing with test data isolation and cleanup.

---

## Core principles

1. **Never use real PII** — all data is synthetic, generated at runtime
2. **Tests are the source of truth** — tests create the data they need
3. **Unique names prevent collisions** — every test run creates uniquely named entities
4. **Static data is documented** — pre-seeded records are listed in `test-data/README.md`

---

## Implementation — the `data` fixture

`fixtures/data.fixture.ts` exposes one provider-agnostic `data` object (built on the
dep-free `fake` core in `utils/test-data.ts`):

| Namespace                                            | Backed by         | Use for                                                                                          |
| ---------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `data.taskName()`, `data.email()`, `data.unique()` … | dep-free `fake`   | **entities you create and persist** — always unique, no collisions                               |
| `data.realistic.*`                                   | `@faker-js/faker` | human-plausible display values (names, prose, emails)                                            |
| `data.edge.*`                                        | hand-rolled       | boundary/stress (long, unicode, emoji, whitespace) + input-hardening probes (`sqlish`, `xssish`) |

```typescript
import { test } from '../fixtures';

test('creates a task', async ({ taskListPage, data }) => {
  await taskListPage.createTask(data.taskName()); // unique, safe to persist
});
```

Set `FAKER_SEED` to make `data.realistic.*` reproducible in a run. See
`framework-tests/foundation.spec.ts` for a runnable offline example.

---

## 1. The `fake` factory (`utils/test-data.ts`)

Import the `fake` singleton for all dynamic test data generation:

```typescript
import { fake } from '../utils/test-data';

const title = fake.taskName(); // "Automated Task · 2026-03-29 · 0001"
const project = fake.projectName(); // "Test Project · 2026-03-29 · 0002"
const comment = fake.comment(); // "Automated comment · 2026-03-29 · 0003"
const email = fake.email(); // "qa-1711234567-0004@testmail.invalid"
const names = fake.taskNames(3); // ["Task 1", "Task 2", "Task 3"]

// Custom base name
const critical = fake.taskName('Critical Bug'); // "Critical Bug · 2026-03-29 · 0005"
```

### Why `fake` over Faker.js directly

- No external dependency to manage
- Deterministic counter makes test output traceable
- ISO date suffix identifies data from a specific run
- Always unique — safe for entities you persist (no cross-run collisions)

For richer, human-plausible values, faker is wired in alongside it as
`data.realistic.*` — see §6.

---

## 2. Static pre-seeded test data

Some tests rely on records that must exist before the test runs (e.g., a task
named "Task 1" that the search test finds). Document these in `test-data/README.md`:

```markdown
# test-data/README.md

## Pre-seeded records (required before running the suite)

These records are expected to exist in the staging environment.
If the suite fails with "element not found" errors, check that seeding was run.

| Entity | Name   | Why needed                               |
| ------ | ------ | ---------------------------------------- |
| Task   | Task 1 | Search tests, task management tests      |
| Task   | Task 2 | Task management smoke test (title edit)  |
| Task   | Task 3 | Task management regression (add comment) |
```

Pre-seeded data should be created once per environment by the setup script
and treated as **read-only** by tests. Tests must not modify or delete them.

---

## 3. Test data isolation strategies

### Option A: Unique names (recommended for most cases)

Generate a unique title for each test run. Tests read their own data by name.

```typescript
const taskTitle = fake.taskName('Invoice Task');
// Creates: "Invoice Task · 2026-03-29 · 0001"
// Test searches for this exact string — no collision with other runs
```

### Option B: the `cleanup` fixture (teardown) — **recommended for anything persisted**

Any test that creates a persistent record registers how to remove it; the
`cleanup` fixture (`fixtures/cleanup.fixture.ts`) disposes everything afterwards.

```typescript
test('creates a task', async ({ taskListPage, data, cleanup, api }) => {
  const name = data.taskName();
  const id = await taskListPage.createTask(name);

  // Transport-agnostic: delete via the API fixture…
  cleanup.register(`task ${name}`, () => api.delete(`/api/v2/task/${id}`));
  // …or drive a Page Object, if the app has no API:
  // cleanup.register(`task ${name}`, () => taskListPage.deleteTask(name));
});
```

Guarantees (proven by `framework-tests/cleanup.spec.ts`):

| Rule                 | Behaviour                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| LIFO                 | disposers run in reverse order — children before parents                                                             |
| Always runs          | teardown happens **even when the test fails**, so failures don't leak data                                           |
| Error isolation      | one throwing disposer never blocks the others                                                                        |
| Never fails the test | cleanup problems become an annotation + warning, not a failure — cleanup noise must not mask a real pass/fail signal |

### Option C: Dedicated test area

Create a dedicated area (a list, project, or namespace) in the app for
automated tests. Tests run inside it and it can be wiped and re-seeded in CI.

---

## 4. Sensitive data rules

| Data type     | Rule                                                |
| ------------- | --------------------------------------------------- |
| Passwords     | Always from `.env` — never hardcoded                |
| Emails        | Use `@testmail.invalid` domain — never real domains |
| Names         | Use `fake.unique()` — never real names              |
| Phone numbers | Random format only — never real numbers             |
| Addresses     | Fictional — never real addresses                    |
| Screenshots   | Masked in CI if they show PII fields                |

---

## 5. `test-data/` folder structure

```
test-data/
├── .auth/
│   ├── user.json       saved storageState — gitignored
│   ├── admin.json      admin role state — gitignored
│   └── viewer.json     viewer role state — gitignored
├── api-responses/
│   └── tasks.json      static JSON for network mocking stubs
└── README.md           documents all pre-seeded records
```

---

## 6. Richer data with `@faker-js/faker` (integrated)

`@faker-js/faker` is already wired in as the `data.realistic.*` provider (see
**Implementation — the `data` fixture** above). Reach for it when you need
human-plausible names, prose, companies, or emails:

```typescript
import { test } from '../fixtures';

test('shows a realistic display name', async ({ data }) => {
  const name = data.realistic.name(); // e.g. "González-O'Brien"
  const email = data.realistic.email(); // e.g. "amara.okoye@example.com"
  const bio = data.realistic.paragraph();
  // ...
});
```

Rule of thumb: use the dep-free `data.*` core for anything you **persist** (it is
always unique); use `data.realistic.*` for **display** values. Set `FAKER_SEED` to
make a run reproducible.
