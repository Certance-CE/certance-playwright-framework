---
title: Agent Orchestration — Autonomous Runtime & Closed-Loop Healer
audience: qa-lead
status: review
---

# Agent Orchestration — Autonomous Runtime & Closed-Loop Healer

This is Phase 1 + 2 of the spec-driven orchestration: an **autonomous agent
runtime in CI** and a **closed-loop healer** that fixes failing tests without a
human in the loop. It turns the framework's IDE-only agents into ones that also
run in GitHub Actions.

```
 SPEC → generate → review → [ Pipeline ] ─ green ─► ready
                                 │
                                 └─ red ─► [ Auto-Heal ]  fetch context → fix locator → push
                                              │
                                              └──── re-run Pipeline (max 2 attempts) ─►
```

## Where the chain starts — `certance-starter`

The first agent on a new engagement is the [`certance-starter`](STARTER-DISPATCHER.md)
dispatcher. It doesn't run tests — it decides **how you should start** (existing
BDD, local specs, a Confluence page, or project docs on the web) and hands off to
the right agent below. For external sources it routes through `source-to-requirements`
(stage 0), which normalizes them into `requirements/*.md`. Everything in this
document is about what happens **after** that hand-off.

## The IDE agents are runtime-agnostic

The planner / generator / healer / remote-healer live in `.github/agents/*.agent.md`
with `.github/copilot-instructions.md` — the **GitHub Copilot / VS Code** custom-agent
format. They run unchanged in **Copilot Chat** (pick a Claude model in Copilot's
model picker) _or_ Claude Code. Nothing below is needed to use them in an IDE;
this is only about the **autonomous CI runtime**.

## What ships

| Workflow                                  | Runtime     | Role                                                                               |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `.github/workflows/claude.yml`            | Claude      | Runs Claude Code in CI on `@claude` mentions — the autonomous runtime              |
| `.github/workflows/auto-heal.yml`         | Claude      | Closed-loop healer via the Claude Code Action → fixes, pushes, re-runs             |
| `.github/workflows/auto-heal-copilot.yml` | **Copilot** | Closed-loop healer that delegates to the **Copilot coding agent** → opens a fix PR |

## Choosing the CI runtime

Set the **`AGENT_RUNTIME`** repository variable (Settings → Secrets and variables
→ Actions → Variables) to select the autonomous runtime — the two healers are
mutually exclusive:

| `AGENT_RUNTIME`     | Autonomous healer                              | Needs                                                        |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| **unset** (default) | **none** — no healer fires                     | — (safe default: an unconfigured repo never runs the healer) |
| `claude`            | `auto-heal.yml` (Claude Code Action)           | `ANTHROPIC_API_KEY` secret                                   |
| `copilot`           | `auto-heal-copilot.yml` (Copilot coding agent) | `COPILOT_PAT` secret + Copilot coding agent enabled          |

The healer is **opt-in**: until you set `AGENT_RUNTIME`, a failing PR just fails
(no auto-heal run appears). This avoids red auto-heal runs on a repo that hasn't
configured a runtime yet.

> **Copilot-only customer?** Set `AGENT_RUNTIME=copilot`. The IDE agents already
> work in Copilot; this just points the CI healer at the Copilot coding agent
> instead of the Anthropic API. No Anthropic key required anywhere.

## One-time setup (required)

Nothing runs until the chosen runtime is configured. Common to both:
**Workflow permissions** — Settings → Actions → General → Workflow permissions:
**Read and write permissions** + **Allow GitHub Actions to create and approve
pull requests**.

### Claude runtime (`AGENT_RUNTIME=claude`)

- **`ANTHROPIC_API_KEY` secret** — Settings → Secrets and variables → Actions.
  _(Bills against the Anthropic API — real cost per `@claude` invocation and per
  auto-heal attempt.)_

### Copilot runtime (`AGENT_RUNTIME=copilot`)

- **Enable the Copilot coding agent** for the repo/org (Copilot settings) — the
  `copilot-swe-agent` bot must be assignable.
- **`COPILOT_PAT` secret** — a **fine-grained PAT** (not `GITHUB_TOKEN`, which
  cannot assign Copilot — it bills per user). Permissions: metadata read;
  actions, contents, issues, pull requests read+write. _(Bills against the PAT
  owner's Copilot seat.)_
- Set the **`AGENT_RUNTIME`** variable to `copilot`.

## How the closed loop works

1. `Playwright Tests` fails on a PR/feature branch → `auto-heal.yml` fires
   (`workflow_run`). It never fires for the default branch.
2. **Iteration guard** — it counts `[auto-heal]` commits on the branch and stops
   after **2 attempts**, commenting on the PR so a human takes over. This is the
   safeguard against an infinite heal loop.
3. It checks out the branch, installs deps, and runs the Remote Healer (Claude
   Code) with the prompt from `.github/agents/playwright-remote-healer.agent.md`:
   read `error-context.md` first, fix only the broken locator with the role
   hierarchy, verify `bdd:gen` + `typecheck`, commit `[auto-heal] …`, push.
4. It re-dispatches `playwright.yml` on the branch to re-run the suite —
   closing the loop. A pass ends it; a fail re-enters auto-heal until the cap.

**Copilot variant** (`auto-heal-copilot.yml`): instead of committing to the
branch directly, it files an issue with the same Remote Healer brief and assigns
the `copilot-swe-agent`, which works autonomously and **opens a fix PR** against
the branch — so auto-fixes pass through PR review before merge. Same 2-attempt
cap (counted by `[auto-heal]` issues).

## Guardrails

| Risk               | Mitigation                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Infinite heal loop | Hard cap of 2 `[auto-heal]` commits per branch, then escalate                                       |
| Healing `main`     | Condition excludes the default branch                                                               |
| Unbounded cost     | Capped attempts + `--max-turns 30`; you control the model via `claude_args`                         |
| Weakening tests    | Prompt forbids touching passing tests / weakening assertions; unfixable tests become `test.fixme()` |
| Runaway tool use   | `--allowedTools` limits Claude to Edit/Read/Write/Bash/Grep/Glob                                    |

## Not yet wired (Phases 3–5)

Spec → generate (a `.feature` change opens a generated PR), a reviewer agent
gate, and a merge gate (green + review + coverage). The runtime shipped here is
the prerequisite for all of them.

> Tracked with everything else in [`docs/ROADMAP.md`](ROADMAP.md) — update priorities there.

## Related

- [`docs/STARTER-DISPATCHER.md`](STARTER-DISPATCHER.md) — the dispatcher that starts the chain
- [`docs/AGENT_VERIFICATION.md`](AGENT_VERIFICATION.md)
- [`.github/agents/playwright-remote-healer.agent.md`](../.github/agents/playwright-remote-healer.agent.md)
- [`skills/playwright-agent-workflows/SKILL.md`](../skills/playwright-agent-workflows/SKILL.md)
