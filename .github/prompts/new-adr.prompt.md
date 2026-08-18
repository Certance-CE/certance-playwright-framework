---
mode: agent
description: >
  Generate a complete Architecture Decision Record (ADR) for a framework design
  decision. Produces a fully structured ADR file in docs/06-decision-log/ following
  the Certance ADR template. Reads relevant source files and skills before writing.
---

# Prompt: New Architecture Decision Record

You are acting as the Certance technical writer. Generate a complete ADR for the
following decision: **${input:decision:Describe the design decision, e.g. "why we use getByRole over CSS selectors"}**

## Your steps

1. Identify which source files or skill files are relevant to this decision.
   Read them before writing anything.

2. Determine the next ADR number by listing `docs/06-decision-log/` and finding
   the highest existing ADR number. Increment by 1.

3. Generate a kebab-case filename slug from the decision title.
   Example: "use STORAGE_STATE_BASE64 for auth" → `ADR-003-storage-state-base64-auth.md`

4. Write the ADR to `docs/06-decision-log/ADR-NNN-<slug>.md` using this exact template:

```markdown
---
title: 'ADR-NNN: <Decision Title>'
section: 'arc42 §9 — Architecture Decisions'
audience: engineer
status: Proposed
date: <today's date YYYY-MM-DD>
deciders: Framework Architects
---

# ADR-NNN: <Decision Title>

> **Status:** Proposed
> **Date:** <today's date>

## Context

<Why this decision was needed. What problem it solves. What constraints existed.
Reference the specific Certance golden rule or framework requirement that drove it.
2–4 sentences. No vague language.>

## Options considered

| Option                           | Pros                   | Cons                  |
| -------------------------------- | ---------------------- | --------------------- |
| <Option A — the chosen approach> | <what's good about it> | <what's harder>       |
| <Option B — main alternative>    | <what's good about it> | <why it was rejected> |
| <Option C — if applicable>       | <what's good about it> | <why it was rejected> |

## Decision

<One clear sentence stating what was decided.>

<Two to four sentences explaining the core reasoning. Connect to a business or
quality outcome, not just technical preference.>

## Consequences

**Positive:** <What improves. Be specific.>

**Negative:** <What becomes harder or more constrained. Be honest.>

**Risks:** <What could go wrong, and how the risk is mitigated.>

## Related

- [Golden Rules](../08-contributing/golden-rules.md) — framework non-negotiables
- [<relevant skill file>](<relative path>) — <one-line description>
```

5. After writing, run the self-audit:
   - YAML frontmatter complete?
   - Options table has at least 2 rows?
   - Decision section has a clear one-sentence statement?
   - No client names or credentials present?
   - Related section has at least one link?

6. Report: "ADR created at `docs/06-decision-log/<filename>.md`. Status: Proposed.
   Review and change status to Accepted when the team confirms."
