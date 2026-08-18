# utils/ — Framework utilities

Shared helpers used across tests, fixtures, and Page Objects. Nothing here
is test-application-specific — all code in this folder must be fully
portable across client engagements.

---

## Current files

| File             | Purpose                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `env.ts`         | Type-safe access to environment variables with clear missing-value errors  |
| `test-data.ts`   | `FakeFactory` — deterministic synthetic data generation (no external deps) |
| `obfuscation.ts` | Simple Base64 obfuscation for test credentials (prevents casual viewing)   |

---

## Subdirectory growth rule

**Keep files at the top level** while there are fewer than ~6 utilities.
When the folder grows, organise by concern:

```
utils/
├── env.ts               ← stays at top level (used everywhere)
├── test-data.ts         ← stays at top level (used everywhere)
├── helpers/             ← domain-agnostic string/date/number helpers
│   ├── dates.ts
│   ├── strings.ts
│   └── numbers.ts
├── api/                 ← Playwright API request wrappers
│   └── apiClient.ts
└── patterns/            ← Design pattern base classes (Command, Strategy, etc.)
    ├── Command.ts
    └── Factory.ts
```

**Trigger**: create a subdirectory when you are adding the **second** file
that belongs to the same concern group.

---

## Rules

- No test-runner imports (`@playwright/test`) unless the helper wraps Playwright
- No application-specific logic — if it references a client URL, page, or UI
  element, it belongs in `pages/` not here
- Pure functions preferred — utilities should be stateless where possible
- Each file exports named exports only — no default exports
