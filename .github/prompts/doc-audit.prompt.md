---
mode: agent
description: >
  Audit documentation coverage against the actual codebase. Identifies undocumented
  Page Objects, fixtures, skills, CI workflows, and ADR gaps. Produces a prioritised
  gap report with suggested next documentation tasks.
---

# Prompt: Documentation Coverage Report

You are acting as the Certance technical writer. Audit the documentation coverage
of this repository and produce a gap report.

## Your steps

### 1. Inventory the codebase

Read and list the following:

| Source               | What to list                             |
| -------------------- | ---------------------------------------- |
| `pages/`             | All `.ts` files (Page Object classes)    |
| `fixtures/`          | All `.ts` files (fixture definitions)    |
| `skills/`            | All `*.md` files (knowledge base skills) |
| `.github/workflows/` | All `.yml` files (CI workflows)          |
| `.github/agents/`    | All `.agent.md` files                    |
| `utils/`             | All `.ts` files                          |

### 2. Inventory existing documentation

List all `.md` files in `docs/` (excluding `node_modules`).

### 3. Cross-reference: identify gaps

For each source item, determine whether documentation exists.

Coverage categories:

| Category     | Source                                            | Expected doc location                                   |
| ------------ | ------------------------------------------------- | ------------------------------------------------------- |
| Page Objects | `pages/*.ts`                                      | `docs/03-framework-structure/pages/*.md`                |
| Fixtures     | `fixtures/*.ts`                                   | `docs/03-framework-structure/fixtures.md` (or per-file) |
| Skills       | `skills/**/*.md`                                  | `docs/04-knowledge-base/skills/*.md`                    |
| CI Workflows | `.github/workflows/*.yml`                         | `docs/05-ci-cd/*.md`                                    |
| Agents       | `.github/agents/*.agent.md`                       | `docs/02-architecture/agent-pipeline.md` (inline)       |
| ADRs         | Golden rules in `.github/copilot-instructions.md` | `docs/06-decision-log/ADR-*.md`                         |

### 4. Check navigation hub

Read `docs/README.md`. For every doc that exists, verify it is linked from the README.
List any docs that exist but are not linked (orphaned pages).

### 5. Check frontmatter completeness

For each doc in `docs/`, check that it has:

- `title` field
- `audience` field
- `status` field

List any docs missing required frontmatter fields.

### 6. Generate the gap report

Write the report to `docs/doc-coverage.md`:

```markdown
---
title: 'Documentation Coverage Report'
section: 'Meta'
audience: qa-lead
status: draft
last-updated: <YYYY-MM-DD>
---

# Documentation Coverage Report

> **Generated:** <date>
> **Summary:** <N> source files, <N> documented, <N> gaps identified.

## Coverage by category

| Category     | Total | Documented | Missing | Coverage % |
| ------------ | ----- | ---------- | ------- | ---------- |
| Page Objects | N     | N          | N       | N%         |
| Fixtures     | N     | N          | N       | N%         |
| Skills       | N     | N          | N       | N%         |
| CI Workflows | N     | N          | N       | N%         |
| ADRs         | N     | N          | N       | N%         |

## Missing documentation — prioritised

### Priority 1 — Critical gaps (blocks new engineer onboarding)

<List items that a new engineer would need immediately>

### Priority 2 — Architecture gaps (blocks system understanding)

<List items needed to understand the framework design>

### Priority 3 — Reference gaps (nice to have, not blocking)

<List items that are helpful but not urgent>

## Orphaned documents (exist but not linked from README)

| File   | Issue                          |
| ------ | ------------------------------ |
| <path> | Not linked from docs/README.md |

## Frontmatter issues

| File   | Missing fields   |
| ------ | ---------------- |
| <path> | audience, status |

## Recommended next tasks

1. `<specific prompt command>` — to close Priority 1 gap: <item>
2. ...

## Related

- [docs/README.md](README.md) — navigation hub
- [Contributing guide](08-contributing/golden-rules.md)
```

### 7. Report summary in chat

After writing the file, output:
"Audit complete. <N> gaps found across <N> categories.
Report written to `docs/doc-coverage.md`.
Highest priority: <top 3 missing items>."
