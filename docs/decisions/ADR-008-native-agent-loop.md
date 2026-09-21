# ADR-008 — Consume Playwright's native agents; govern via a patch layer and a drift check

**Date:** 2026-09-21
**Status:** Accepted
**Deciders:** Certance Lens architecture

---

## Context

Playwright has shipped planner, generator and healer agents in the box since 1.56.
Competing on agent *quality* is competing with Microsoft. The framework's differentiator is
not the agents; it is **governing what they produce**.

The repo previously carried hand-authored agent briefs under `.github/agents/`. A review
found the generator brief had **drifted from upstream and dropped the `browser_verify_*`
tools** — the live-DOM grounding loop that is the mechanism preventing an agent from inventing
a locator. Claude Code, meanwhile, had no agents at all while Copilot had seven.

---

## Decision

**Consume the upstream agents; never fork them.** Generate planner/generator/healer with
`npx playwright init-agents --loop=claude` into `.claude/agents/`, commit them **pristine**,
and wire the Playwright test MCP via `.mcp.json`. Governance lives in a **separate patch
layer** (`.claude/CLAUDE.md` + `AGENTS.md` + the Certance-owned front agents), never inside a
generated agent file. A drift check, `npm run agents:sync` (`scripts/agents-sync.js`),
regenerates the upstream agents and fails if the committed copies differ; it runs in CI.

The Certance-owned front of the pipeline — `certance-starter`, `source-to-requirements`,
`requirements-to-bdd` — is authored by us (it has no upstream equivalent) and lives alongside
the generated agents in both `.github/agents/` (Copilot) and `.claude/agents/` (Claude Code).

---

## Rationale

Keeping the generated agents byte-identical to upstream is what makes the drift check
meaningful and keeps the `browser_verify_*` grounding loop from being lost again. Putting
governance in the agent files would defeat the check (a governance edit would read as drift)
and would rot on the next `init-agents`. So governance goes in a layer the regeneration never
touches, and is enforced downstream anyway — by the nine lint-enforced golden rules on the
code the agent produces and by the human review gate (GATE 1).

Proven: the regenerated generator carries `browser_verify_element_visible`/`list_visible`/
`text_visible`/`value` and `generator_setup_page`/`read_log`/`write_test`; `agents:sync` is
verified to pass in sync and to exit non-zero on a hand-edit, and runs in the CI Lint job.
Shipped in PR #52 (loop + governance + local check) and PR #54 (Claude Code parity + CI
enforcement).

---

## Alternatives considered

| Alternative | Why rejected |
| ----------- | ------------ |
| Keep hand-authored agent briefs | They drift from upstream and silently lose capabilities (the dropped grounding loop is exactly this failure). |
| Write our own generator/healer | Competing with Microsoft on commoditised generation; wasted effort against the differentiator (governance). |
| Patch the generated agent files in place | Defeats the drift check and is reverted by the next regeneration. |
| A runtime self-healing locator engine | Rejected as a standing decision: similarity is not semantic equivalence; it manufactures the false confidence this design prevents. |

---

## Consequences

**Positive:**

- The generator verifies every locator against the live DOM before writing it.
- A Playwright upgrade's agent improvements arrive by regeneration, not hand-maintenance.
- The fork can never silently diverge again — CI fails on drift.
- Claude Code and Copilot have parity across the whole pipeline.

**Negative / trade-offs:**

- `agents:sync` depends on `init-agents` being deterministic and offline-safe (verified today;
  a future Playwright change could alter output and require a re-commit — which is the check
  working, not failing).
- Governance is not inside the agent, so it relies on the agent reading the project context
  plus the downstream lint + human gate. That is by design (fail-safe, not fail-open).

**Risks:**

- An upstream agent change that removes a grounding tool would pass `agents:sync` (it only
  checks *our* copy matches upstream) but weaken the loop. Watch upstream release notes.

---

## Review date

Revisit on any major `@playwright/test` upgrade (re-run `init-agents`, re-review the diff), or
if `init-agents` stops being deterministic/offline in CI.
