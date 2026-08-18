---
title: certance-starter — the dispatcher
audience: qa-lead
status: stable
---

# certance-starter — the dispatcher (first agent to run)

On a new website or application there are **four ways** to start creating tests.
`certance-starter` is a thin **router**: it works out which one applies and hands
off to the right existing agent. It doesn't write tests, specs, or Page Objects —
it routes. (Routing / orchestrator-worker is the most common production
multi-agent pattern; the dispatcher just makes the choice explicit and repeatable.)

```
① existing .feature files ─────────────────────────────► playwright-test-generator
② requirements/*.md ───────────────────────────────────► requirements-to-bdd
② Jira / Confluence ─┐
④ docs URL / web ────┴─► source-to-requirements ─► requirements/<AREA>.md ─► requirements-to-bdd
③ running app (explore) ───────────────────────────────► playwright-test-planner
```

Modes ② (external) and ④ **converge**: both normalize onto the same
`requirements/<AREA>.md` the pipeline already consumes, so nothing downstream is
bespoke per source.

## The four modes

| #    | You are starting from…                                           | Route to                     | Then run          |
| ---- | ---------------------------------------------------------------- | ---------------------------- | ----------------- |
| ①    | Existing BDD scenarios (`features/*.feature`)                    | `playwright-test-generator`  | `npm run bdd:gen` |
| ②    | Local requirement specs (`requirements/*.md`)                    | `requirements-to-bdd`        | `npm run bdd:gen` |
| ②ext | External specs — Jira issue / **Confluence** page                | `source-to-requirements` → ② | —                 |
| ④    | Project docs on the web (requirements / how-to / user guide URL) | `source-to-requirements` → ② | —                 |
| ③    | Nothing but a running app                                        | `playwright-test-planner`    | review the plan   |

## How the router decides

It combines a **deterministic repo scan** with your **stated intent**:

```bash
npm run starter:detect                         # scan the repo
npm run starter:detect -- --url <docs-url>      # you have a docs URL (mode ④)
npm run starter:detect -- --confluence <id|SPACE>   # a Confluence page/space (mode ②ext)
```

The detector prints which modes are `viable`, a `recommended` route, and an
`ambiguous` flag (emitted as a machine-readable `BEGIN_JSON … END_JSON` block).
The agent then:

- takes an explicit source you named (URL → ④, Confluence/Jira → ②ext, "explore
  the app" → ③) over the repo default, and
- **asks one question only when `ambiguous`** — e.g. both `features/` and
  `requirements/` are populated. Routing to `requirements-to-bdd` can overwrite a
  hand-tuned `features/*.feature`, so it won't guess when overwriting could lose work.

## Mode ④ walkthrough — BDD from project docs on the web

1. `certance-starter` detects a docs URL and routes to `source-to-requirements`.
2. `source-to-requirements` fetches the real page text (grounding, no guessing):
   ```bash
   npm run fetch:doc -- https://your-project/docs/checkout-requirements --max 40000
   ```
3. It extracts the requirements into `requirements/<AREA>.md` (template format),
   flagging anything ambiguous as `# TODO:` rather than inventing it.
4. `requirements-to-bdd` turns that into a tagged `features/<feature>.feature`.
5. `npm run bdd:gen` → `playwright-test-generator` → `npm run coverage:requirements`
   gives you a traceability matrix from **doc → requirement → scenario → test**.

## Mode ② external — Confluence via the Atlassian MCP (opt-in)

Confluence ingestion uses the **Atlassian Remote MCP Server** (Confluence + Jira),
declared in `.claude/agents/source-to-requirements.md`. It is **opt-in** and needs
a one-time authorization — until then, the agent reports the setup step instead of
fabricating content (same philosophy as `AGENT_RUNTIME` in
[`AGENT_ORCHESTRATION.md`](AGENT_ORCHESTRATION.md)).

**Setup (Claude Code):** the agent starts the MCP via
`npx -y mcp-remote https://mcp.atlassian.com/v1/sse`; on first use `mcp-remote`
opens a browser OAuth flow to your Atlassian site. After you approve, the agent
can call `getConfluencePage`, `getPagesInConfluenceSpace`, and
`searchConfluenceUsingCql`. Give it a **page id**, a **space key**, or a **search
phrase**.

**Copilot-only environment:** the web-URL path (mode ④) works in Copilot via the
terminal fetcher. The Confluence-MCP path is a Claude Code capability — if you need
Confluence under Copilot, paste the page text and treat it as a URL-less source, or
use a commercial connector (below).

## Follow-ons (not built in v1)

> Tracked with everything else in [`docs/ROADMAP.md`](ROADMAP.md).

- **Jira ticket ingestion** — same shape as Confluence via the Atlassian MCP
  (Jira tools), feeding `source-to-requirements`.
- **Commercial Gherkin ↔ Jira sync** — if the customer already lives in Jira:
  [AssertThat](https://www.assertthat.com/),
  [Cucumber for Jira](https://cucumberforjira.atlassian.net/wiki/spaces/C4JD/overview),
  [QMetry (QTM4J)](https://qmetrysupport.atlassian.net/wiki/spaces/QTM4J/pages/2902032513),
  [BDD for Jira](https://marketplace.atlassian.com/apps/1235236/bdd-for-jira). These
  sync feature files to Git; from there mode ① takes over.

## Related

- [`docs/REQUIREMENTS-PIPELINE.md`](REQUIREMENTS-PIPELINE.md) — the ② pipeline this feeds
- [`docs/AGENT_ORCHESTRATION.md`](AGENT_ORCHESTRATION.md) — CI runtimes for the agents
- [`requirements/_TEMPLATE.md`](../requirements/_TEMPLATE.md) — the requirement format
