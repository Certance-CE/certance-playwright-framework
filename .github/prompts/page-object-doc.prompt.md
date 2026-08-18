---
mode: agent
description: >
  Generate complete documentation for a Playwright Page Object class.
  Reads the source TypeScript file, extracts the public API, and produces
  a structured Markdown doc in docs/03-framework-structure/pages/.
---

# Prompt: Page Object Documentation

You are acting as the Certance technical writer. Document the Page Object class
in: **${input:file:Path to the Page Object file, e.g. pages/TaskPage.ts}**

## Your steps

1. Read the specified file completely. Extract:
   - Class name and constructor signature
   - All public methods: name, parameters, return type, purpose
   - Any locator constants or notable private patterns worth explaining
   - Which application page or component this class represents

2. Read `skills/pom/` if it exists to understand the POM conventions
   this class should follow.

3. Determine the output file path:
   - `pages/TaskPage.ts` → `docs/03-framework-structure/pages/task-page.md`
   - Use kebab-case for the filename

4. Generate the documentation file using this structure:

````markdown
---
title: '<ClassName> — Page Object'
section: 'arc42 §5 — Building Block View'
audience: engineer
status: draft
last-updated: <YYYY-MM-DD>
source-file: <relative path to .ts file>
---

# <ClassName>

> **Audience:** Engineers writing or maintaining tests for <page/component name>
> **TL;DR:** Page Object encapsulating all interactions with the <page name> page.

## Overview

<2–3 sentences. What page or component this represents, what features it covers,
and why it exists as its own Page Object rather than part of another.>

## Constructor

```typescript
constructor(page: Page)
```
````

| Parameter | Type   | Description                                           |
| --------- | ------ | ----------------------------------------------------- |
| `page`    | `Page` | Playwright Page instance injected by the test fixture |

## Public methods

| Method           | Parameters      | Returns         | Description    |
| ---------------- | --------------- | --------------- | -------------- |
| `<methodName>()` | `<param: type>` | `Promise<void>` | <what it does> |
| ...              | ...             | ...             | ...            |

## Usage example

```typescript
// In a test fixture or spec file
const taskPage = new <ClassName>(page);
await taskPage.<primaryMethod>();
await expect(taskPage.<locator>).toBeVisible();
```

## Locator strategy

<Brief note on which locator strategy this class uses and why.
Reference the golden rule if relevant.>

## Notes

<Any non-obvious behaviours, known limitations, or things a junior engineer
might get wrong. If none, omit this section.>

## Related

- [Page Objects overview](../page-objects.md) — POM pattern and naming conventions
- [Fixtures](../fixtures.md) — how Page Objects are injected into tests
- [ADR: Locator strategy](../../06-decision-log/ADR-001-locator-strategy.md)

```

5. Self-audit before submitting:
   - Every method in the source file is in the methods table?
   - Usage example is syntactically valid TypeScript?
   - No assumptions — every statement traceable to the source file?
   - `[VERIFY]` tags on anything uncertain?

6. Report: "Documentation created at `docs/03-framework-structure/pages/<filename>.md`.
   <N> public methods documented."
```
