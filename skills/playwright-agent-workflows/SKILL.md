---
name: playwright-agent-workflows
description: 'Use when assessing or designing Playwright planner, generator, healer, reviewer, and library-manager workflows for low-token agentic test creation.'
---

# Playwright Agent Workflows Skill

Use this skill when a Playwright project uses multiple agents to plan, generate, heal, review, or refactor tests.

## Recommended Phase Boundaries

1. **Plan:** Explore one scoped feature and save a compact plan artifact.
2. **Review:** Human-trim the plan before generation.
3. **Generate:** Start a fresh session using only the plan, relevant Page Object, fixture, and skill references.
4. **Validate:** Run the narrow generated test or BDD scenario only.
5. **Heal:** Use healer only for failing locators, assertions, or timing problems.
6. **Review:** Review the narrow diff for behavioral risk and framework-rule violations.
7. **Library:** Consolidate reusable patterns only after repetition is proven.

## Role Boundaries

| Role            | Owns                                               | Should Avoid                                 |
| --------------- | -------------------------------------------------- | -------------------------------------------- |
| Planner         | scoped discovery and plan artifact                 | whole-app exploration by default             |
| Generator       | tests from approved plan and existing abstractions | broad repository scans and verbose rationale |
| Healer          | failing locator or assertion diagnosis             | rewriting architecture or passing tests      |
| Reviewer        | narrow diff risks                                  | reading full files when diff is enough       |
| Library manager | repeated abstractions                              | generalizing before at least three examples  |

## Audit Warnings

- Planner and generator share the same long chat history.
- Generator depends on live MCP output for every test in a batch.
- Healer has broad MCP access when only debug/snapshot/locator tools are needed.
- Reviewer requests broad context instead of a narrow diff.
- Library manager runs before patterns have repeated.
