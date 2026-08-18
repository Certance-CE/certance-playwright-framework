---
name: playwright-transport-routing
description: 'Use when deciding whether Playwright test planning, generation, debugging, or healing should use CLI, MCP, codegen, snapshots, or narrow terminal commands.'
---

# Playwright Transport Routing Skill

Use this skill when choosing between Playwright CLI, MCP, codegen, snapshots, and terminal output for agentic work.

## Default Routing

| Task                        | Preferred Transport                          | Why                                                  |
| --------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Bulk test generation        | Playwright CLI or existing plan artifacts    | Lower repeated context, file-based outputs           |
| Initial feature exploration | MCP, scoped to one feature                   | Useful when live UI discovery is required            |
| Locator healing             | MCP with narrow debug/snapshot tools         | Needs live accessibility tree, but only for failures |
| CI failure triage           | Terminal output, compressed to failing block | Avoids sending full reports and logs                 |
| BDD step generation         | Feature files and Page Objects               | Stable compact inputs                                |
| Regression review           | Diff and changed files only                  | Avoids full repo reads                               |

## MCP Use Rules

- Use MCP only when live UI state is required.
- Scope MCP sessions to one feature, one failed test, or one locator problem.
- Do not carry MCP exploration output into batch generation sessions.
- Minimize configured MCP tool schemas to the tools agents actually use.
- Avoid screenshots unless the visual state is the object of the task.

## CLI Use Rules

- Prefer CLI or test runner output for repeatable generation and validation.
- Save bulky output to files and read only the relevant part.
- Feed back the smallest failure block: test name, assertion, locator, and top stack frame.

## Audit Warnings

- MCP is used for every locator in every generated test.
- The planner explores the entire application instead of a scoped flow.
- The healer receives all Playwright MCP tools when only a few are required.
- Terminal output is pasted raw instead of reduced.
