---
title: Agent Verification & Smoke Test
audience: qa-lead
status: stable
---

# Agent Verification & Smoke Test

Run this when spinning up the framework's AI agents in a new (client) environment,
to confirm the **planner → generator → healer** pipeline is correctly wired and
working before relying on it.

## When to run

- Day one of a client engagement, after cloning the framework.
- After a Playwright version bump (the agents' MCP server ships with Playwright).
- After editing any `.github/agents/*.agent.md` file.

## Part A — Config & dependency checks (2 min, no IDE needed)

These catch the failures that happen "on spin-up": a bad MCP server command,
missing tools, or malformed agent config.

1. **Playwright present + agents registered for your loop provider**

   ```bash
   npx playwright --version
   npx playwright init-agents --loop copilot   # or: claude | vscode | codex | opencode
   ```

2. **The agents' MCP server launches and exposes the expected tools**

   ```bash
   printf '%s\n' \
     '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"1"}}}' \
     '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
     '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
   | npx playwright run-test-mcp-server 2>/dev/null | grep -o '"name":"[a-z_]*"' | sort -u
   ```

   Expect `browser_snapshot`, `browser_click`, `browser_navigate`, `browser_type`,
   `test_run`, `test_debug`, `test_list`, `planner_setup_page`, `planner_save_plan`.

3. **Agent config is well-formed**

   Every agent that references `playwright-test/*` tools declares the
   `playwright-test` MCP server in its frontmatter; the generator is CLI-only
   (no MCP). Confirm each agent file's YAML frontmatter parses.

## Part B — End-to-end smoke test (5 min, in the IDE agent host)

Run in Copilot Chat (VS Code) or Claude Code with the agents registered.

1. **Auth** — `npm run test:auth` saves `storageState`, so agents can reach
   authenticated features.
2. **Planner** — `@playwright-test-planner plan the <feature> feature`
   - Expect a compact `plans/*.md`; one scoped feature explored (no whole-app crawl).
3. **Generator** (fresh session) — `@playwright-test-generator generate from plans/<feature>.md using pages/ and fixtures/`
   - Expect a `.feature` + step definitions; Page Objects via fixtures; role locators; no MCP-per-locator.
   - Validate: `npm run bdd:gen && npm run typecheck`.
4. **Healer** — break a locator on purpose, run the test, then `@playwright-test-healer`
   - Expect a scoped role-based fix; no architecture rewrite; no healing of passing tests.
5. **Remote-healer** — `@playwright-remote-healer fix failing smoke tests from run <RUN_ID>`
   - Expect it to read `error-context.md` first; only open the full trace if that is insufficient.

## Pass criteria

| Part | Pass when                                                                               |
| ---- | --------------------------------------------------------------------------------------- |
| A    | MCP server launches, all expected tools present, agent YAML valid                       |
| B    | Each agent produces its expected artifact; generated tests pass `bdd:gen` + `typecheck` |

## Troubleshooting

| Symptom                             | Likely cause                                 | Fix                                                                                                                   |
| ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| MCP server errors "unknown command" | Playwright too old                           | Bump Playwright; the test MCP ships with it                                                                           |
| Agent cannot call a tool            | Tool absent from agent frontmatter or server | Compare the agent `tools:` list against the `tools/list` output                                                       |
| Generator uses MCP per locator      | Wrong transport                              | Generator must use CLI — see [`skills/playwright-transport-routing`](../skills/playwright-transport-routing/SKILL.md) |
| Planner crawls the whole app        | Unscoped prompt                              | Scope to one feature — see [`skills/playwright-agent-workflows`](../skills/playwright-agent-workflows/SKILL.md)       |

## Related

- [`docs/ONBOARDING.md`](ONBOARDING.md)
- [`skills/playwright-agent-workflows/SKILL.md`](../skills/playwright-agent-workflows/SKILL.md)
- [`skills/playwright-transport-routing/SKILL.md`](../skills/playwright-transport-routing/SKILL.md)
