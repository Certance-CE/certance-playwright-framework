---
mode: agent
description: >
  Document a SKILL.md file in the Certance knowledge base architecture.
  Produces a human-readable explanation of what the skill does, who reads it,
  what it contains, and how to extend it. Adds the skill to the skill index.
---

# Prompt: Skill Documentation

You are acting as the Certance technical writer. Document the skill file at:
**${input:skill_file:Path to the SKILL.md file, e.g. skills/core/auth.md}**

## Your steps

1. Read the specified skill file completely.

2. Read `docs/04-knowledge-base/skill-architecture.md` if it exists to understand
   the skill system conventions.

3. Read `docs/04-knowledge-base/skill-index.md` if it exists — you will update it.

4. Generate the skill documentation page at:
   `docs/04-knowledge-base/skills/<skill-slug>.md`

   Where `<skill-slug>` is the skill file path converted to kebab-case:
   `skills/core/auth.md` → `docs/04-knowledge-base/skills/core-auth.md`

```markdown
---
title: 'Skill: <Skill Name>'
section: 'arc42 §4 — Solution Strategy / Knowledge Base'
audience: engineer
status: stable
skill-file: <relative path to SKILL.md>
last-updated: <YYYY-MM-DD>
---

# Skill: <Skill Name>

> **Audience:** AI agents (Claude Code, GitHub Copilot) and engineers who extend the skill
> **TL;DR:** <One sentence — what this skill teaches agents to do.>

## Purpose

<2–3 sentences. What problem this skill solves, what it prevents agents from doing
wrong, and in which context agents will read it.>

## Applies when

<Exact condition under which an agent should load this skill.
Be precise — vague trigger conditions cause skill misapplication.>

## Does not apply when

<Situations where loading this skill would be a mistake.>

## Contents

| Section                     | Description      |
| --------------------------- | ---------------- |
| <heading in the skill file> | <what it covers> |
| ...                         | ...              |

## Key rules this skill enforces

<3–5 bullet points capturing the most important constraints or patterns.
These are the things a junior engineer must not get wrong.>

## How to extend this skill

<Step-by-step: how to add a new pattern or rule to this skill file.
When is extension appropriate vs creating a new skill?>

## Example agent usage

<Show a sample prompt or workflow that would cause an agent to read this skill,
and what the agent should do differently as a result.>

## Related

- [Skill index](skill-index.md) — all skills in the knowledge base
- [Authoring skills](authoring-skills.md) — how to write a new skill
- [<related doc>](path) — <description>
```

5. Update `docs/04-knowledge-base/skill-index.md` by adding a row for this skill
   to the skills table:

   | Skill          | File           | Purpose            | Audience         |
   | -------------- | -------------- | ------------------ | ---------------- |
   | `<skill name>` | `<skill-file>` | <one-line purpose> | agent / engineer |

6. Self-audit:
   - "Applies when" section is precise enough to be unambiguous?
   - Key rules section captures the things most likely to go wrong?
   - skill-index.md updated?
   - No assumptions — every statement traceable to the skill file?

7. Report: "Skill documented at `docs/04-knowledge-base/skills/<filename>.md`.
   Skill index updated."
