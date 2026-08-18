---
title: Roadmap
audience: qa-lead
status: living
---

# Roadmap

The single home for **"what's next"**. Before this file, planned work was spread across
four places — [`ARCHITECTURE.md` §10](ARCHITECTURE.md), [`AGENT_ORCHESTRATION.md`](AGENT_ORCHESTRATION.md)
("Not yet wired"), [`STARTER-DISPATCHER.md`](STARTER-DISPATCHER.md) ("Follow-ons"), and
`.claude/CLAUDE.md` ("Open items") — which drifted out of date. Those sections now point here.

**Needs** legend — what unblocks each item:
🔴 the live app + secrets · 🟡 a decision · 🟢 nothing (ready to build)

---

## Strengths to protect (the moat)

A 2026 benchmark (9-agent, web-researched, adversarially verified) scored the framework
**7/10 blended** — engineering 8, coverage-depth 6. These are the validated strengths a
top-tier review found genuinely ahead of market. **Do not regress them** while building
the gap program below; they are why the framework wins.

| Strength                                                                                                                                  | Why it's the moat                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Traceability spine as a build gate** — `requirements → @req → scenario → test → {covered/failing/pending/gap}` with `REQ_FAIL_ON_GAP=1` | An untested acceptance criterion fails the build and surfaces as a first-class gap object — auditable regulatory evidence. Commercial tools charge for this.                                 |
| **`cleanup` fixture proven by an executable contract** (`test.fail()` self-test)                                                          | Teardown-on-failure is the common data-leak; _proving_ it is rare discipline — itself audit evidence.                                                                                        |
| **Grounded `source-to-requirements → BDD`** with anti-hallucination rules                                                                 | Makes AI output defensible, not just plausible — what an AI-Act / DORA reviewer probes.                                                                                                      |
| **Safety-bounded closed-loop healing** — 2-attempt cap, routes real regressions to `test.fixme`, not green                                | The correctness property hobby self-healers get wrong.                                                                                                                                       |
| **Dual-runtime agent chain** (same contracts in Claude _and_ Copilot)                                                                     | De-risks vendor lock-in → DORA concentration-risk. _(The planner/generator/healer triad is now native in Playwright 1.56+; the packaging + traceability wiring is the edge, not the triad.)_ |
| **Adversarial data tier** (`data.edge.sqlish/xssish`) + **journey negative-space gap detection**                                          | Reproducible security/boundary data + detecting tests that were never written.                                                                                                               |
| **Zero-config a11y in the shared fixture chain**                                                                                          | Every test contributes a11y signal into the evidence trail, not a console dump.                                                                                                              |

---

## Now — quality blockers

Things that stand between the suite and "healthy and green".

| Item                                                                                                                                                                                                                  | Why it matters                                                                                                                                                                                                                                                                                                                                         | Needs |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| **Green the `@regression` suite** — heal the 4 broken scenarios                                                                                                                                                       | A reference implementation must be green; broken regression hides real failures                                                                                                                                                                                                                                                                        | 🔴    |
| **Quarantine the known-flaky scenario** — `features/list-views.feature:27` carries a `FIXME` (duplicate `data-test` → strict-mode violation). Tag it `@flaky` so the gate excludes it while it still runs and reports | The `@flaky` lane already exists in CI (`--grep-invert "@wip\|@flaky"`); nothing is tagged into it yet                                                                                                                                                                                                                                                 | 🔴    |
| **Adopt cleanup in the demo tests** — have task-creation use `data.taskName()` (unique) and register a disposer via `cleanup`                                                                                         | The `cleanup` mechanism now ships, but no test uses it yet: `features/task-creation.feature` creates tasks with **hardcoded** names (`"E2E Smoke Task"`), so every run adds another identical task to the shared account. Needs a delete path — `APP_API_TOKEN` for API teardown, or a `deleteTask()` Page Object method verified against the live app | 🔴    |

---

## Next — finish what's half-built

Capabilities that are scaffolded and verified, but not yet live on the real app.

| Item                                                                                                 | State                                                                                | Needs               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------- |
| **Visual baselines** — generate on the CI platform (Linux) and commit, then add a visual CI job      | Harness shipped and proven offline; baselines are per-platform so none are committed | 🔴                  |
| **Real API contract tests** — set `APP_API_TOKEN`, replace the placeholder endpoints in `tests/api/` | `api` fixture shipped; the example skips without a token                             | 🔴                  |
| **Jira ticket ingestion** — Jira tools on the Atlassian MCP, feeding `source-to-requirements`        | Confluence path shipped; Jira is the same shape                                      | 🟡 (Atlassian auth) |
| **`REQ-AUTH-01` is `@wip`** — login can't run headless in CI (reCAPTCHA)                             | Decide: keep permanently `@wip`, or solve via an auth bypass / test-mode token       | 🟡                  |
| **`skills/playwright-cli/yaml-flows.md`** — still marked _Status: Planned_                           | The only remaining unimplemented guide in `skills/`                                  | 🟢                  |
| **`template/` packaging completeness** — confirm the multi-client scaffold is complete               | Long-standing open item in `.claude/CLAUDE.md`                                       | 🟢                  |

---

## Later — agent orchestration, phases 3–5

From [`AGENT_ORCHESTRATION.md`](AGENT_ORCHESTRATION.md). Phases 1–2 (autonomous CI runtime +
closed-loop healer) already ship; these build on them.

| Phase | Item                                                                              |
| ----- | --------------------------------------------------------------------------------- |
| 3     | **Spec → generate** — a `.feature` change automatically opens a generated-code PR |
| 4     | **Reviewer-agent gate** — the reviewer agent must pass before merge               |
| 5     | **Merge gate** — green pipeline + review + coverage thresholds enforced together  |

---

## Gap program — 2026 benchmark findings

Twelve high-value capabilities the benchmark found **absent** (all verified in-repo),
in effort tiers. **Nine of the twelve map onto the regulated-finserv thesis** (fault
injection, DAST, contract testing, mutation score, flake ledger = the "prove resilience"
evidence a DORA/FCA reviewer probes) — so this is the priority backlog, not polish.

### 🟢 Cheap wins — Small effort · High value (do first)

| Gap                                                                                                                                                                 | Why / on-thesis                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API response schema validation** — compile the provider's OpenAPI into `zod`/AJV validators in the `api` fixture; fail on any unannounced field/type/enum change  | The request context already exists — you only add a validator to the assertion path. Turns the `api` fixture into a **provider-drift detector** with audit evidence.                                                  |
| **Machine-enforced golden rules** — `eslint-plugin-playwright` + type-aware `typescript-eslint` + Prettier via Husky/lint-staged + a CI lint job                    | The golden rules are grep/manual-verified only today; lint gates stop AI-generator drift and are evidence the rules held.                                                                                             |
| **Third-party fault injection** — a `degrade(url,{status,delay})` helper on the `network` fixture (latency · 429 · 5xx · timeout) + graceful-degradation assertions | `mockThirdParties` only _aborts_ today — proving tolerance of a _missing_ beacon, not survival of a _slow/rate-limited_ dependency. **DORA expects dependency-failure injection with graceful-degradation evidence.** |

### 🟠 Strategic — Medium effort · High value

| Gap                                                                                                                                                                                                       | Why / on-thesis                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Automated flaky detection + auto-quarantine** — rolling per-test flake score auto-moves offenders into the `@flaky` lane + opens a tracking issue _(supersedes the old "flaky-test intelligence" item)_ | Tagging is manual today; a pipeline green only because humans re-ran it is an evidence-integrity problem. The quarantine ledger is itself evidence of a managed process. |
| **Test-impact analysis** — Playwright `--only-changed` + change→requirement→test selection via the traceability spine; keep a scheduled FULL run _(supersedes the old "test-impact" item)_                | Biggest CI-latency lever left on the table; the strict POM graph makes selection unusually safe. Accelerates feedback — does **not** replace the compliance run.         |
| **Performance budgets in CI** — Lighthouse / Core Web Vitals (LCP·INP·CLS) gating on critical journeys, trended in Allure _(supersedes the old "NFRs in the coverage matrix" item)_                       | Zero perf testing today; latency is an explicit DORA/FCA customer-outcome concern. The `network` fixture already gives a deterministic base.                             |
| **DAST in CI** — HAR / storage-state-seed OWASP ZAP or StackHawk from the authenticated flows                                                                                                             | Security is SAST-only (CodeQL) today — a visible hole for regulated DevSecOps.                                                                                           |
| **Mutation testing (StrykerJS)** — prove the (often AI-generated) assertions actually catch bugs; produce a mutation-score metric                                                                         | The strongest oracle for machine-authored assertions — what a regulator questioning AI coverage will probe.                                                              |
| **AI failure clustering** — run-level clustering (product-bug vs test-issue vs infra) on top of the healer's per-test reasoning                                                                           | On a 4×-sharded suite this is where failures get read; without it, triage doesn't scale.                                                                                 |
| **Framework-as-product distribution** — publish the app-agnostic core as a versioned package (Changesets semver + Renovate + private registry)                                                            | Clients fork/copy today, so fixes don't propagate and aren't auditable; regulated clients need pinned, semver'd deps.                                                    |

### 🔴 Big bets — Large effort · High value

| Gap                                                                                                                                      | Why / on-thesis                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Consumer-driven contract testing (Pact/PactFlow)** — publish/verify pacts + a `can-i-deploy` merge gate                                | The benchmark's **biggest single domain gap** for a framework whose thesis is third-party/operational resilience: proves a dependency change won't break you _without_ a full integration environment. |
| **Ephemeral per-PR environments** — copy-on-write DB branching (Neon/PlanetScale) so shards/reruns can't collide on shared backend state | Browser state is isolated per test; the _data_ layer is shared. Supports DORA non-prod data-isolation expectations.                                                                                    |

### Also tracked — AI-native extensions (differentiators, not benchmark gaps)

- **Coverage-gap → auto-generation loop** — feed the gap report into the generator to propose scenarios for red requirements.
- **Agent-authored PR review comments** — summarise visual diffs + a11y findings into PR comments.
- **Responsive / mobile viewport matrix** — mobile-viewport projects for mobile web.

---

## Optional — commercial integrations

Relevant only if a client already lives in Jira; these sync feature files to Git, after
which dispatcher **mode ①** takes over. See [`STARTER-DISPATCHER.md`](STARTER-DISPATCHER.md).

[AssertThat](https://www.assertthat.com/) · [Cucumber for Jira](https://cucumberforjira.atlassian.net/wiki/spaces/C4JD/overview) · [QMetry (QTM4J)](https://qmetrysupport.atlassian.net/wiki/spaces/QTM4J/pages/2902032513) · [BDD for Jira](https://marketplace.atlassian.com/apps/1235236/bdd-for-jira)

---

## Recently delivered

Kept short, so this file shows momentum and doesn't re-accumulate stale "planned" claims.

| Delivered                                                                                                                                      | PR  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `certance-starter` dispatcher + `source-to-requirements` ingestion (docs URL / Confluence → requirements)                                      | #52 |
| Determinism foundation — `data` fixture (dep-free core + faker + edge) and `network` mocking fixture; accessibility via `@axe-core/playwright` | #53 |
| CI regression sharded 4× with tunable `PW_WORKERS` + shard report merging                                                                      | #54 |
| Visual regression harness + API/contract layer                                                                                                 | #56 |
| Test-data teardown — the `cleanup` fixture (LIFO, runs on failure, error-isolated), closing the last open architectural limitation             | #60 |

Earlier: requirements → BDD → code traceability (#51), Allure coverage taxonomy + gap
reports, Chromium-only consolidation, autonomous agent runtime + closed-loop healer.
