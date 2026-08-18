---
title: Requirements → BDD → Code Pipeline
audience: qa-lead
status: stable
---

# Requirements → BDD → Code Pipeline

Turns written requirements into tests, with **traceability** from each requirement
to the scenario, test, and coverage state that satisfies it. It's the front door
that lets testing start from _"here are the requirements"_ rather than from
_"the app already exists."_

> **Where do requirements come from?** If you don't already have `requirements/*.md`,
> the [`certance-starter`](STARTER-DISPATCHER.md) dispatcher routes you to
> `source-to-requirements` (**stage 0**), which turns a **docs URL** or a
> **Confluence page** into `requirements/*.md` in this same format. From there the
> pipeline below is identical regardless of where the requirements originated.

```
requirements/*.md   (REQ-IDs + acceptance criteria)
     │  requirements-to-bdd agent
     ▼
features/*.feature  (@<feature> @journey:<key> @req:<ID> @smoke|@regression)
     │  npm run bdd:gen  +  playwright-test-generator agent
     ▼
step definitions + Page Objects + specs  →  run  →  allure-results
     │  npm run coverage:requirements
     ▼
requirement traceability matrix + gaps   (req → scenario → test → covered/failing/pending/gap)
```

## Stages

| Stage                           | Command / agent                                       | In                                | Out                              |
| ------------------------------- | ----------------------------------------------------- | --------------------------------- | -------------------------------- |
| 0. Ingest a source _(optional)_ | `certance-starter` → `source-to-requirements`         | docs URL / Confluence page        | `requirements/<area>.md`         |
| 1. Author requirements          | edit `requirements/*.md`                              | —                                 | requirement catalogue            |
| 2. Requirements → BDD           | `requirements-to-bdd` agent                           | `requirements/<area>.md`          | tagged `features/<area>.feature` |
| 3. BDD → code                   | `npm run bdd:gen` + `playwright-test-generator` agent | `features/*.feature`              | step defs + Page Objects + specs |
| 4. Run                          | `npm run bdd:test` (or CI)                            | specs                             | `allure-results`                 |
| 5. Traceability                 | `npm run coverage:requirements`                       | requirements + features + results | matrix + gaps                    |

## The requirement format

See [`requirements/README.md`](../requirements/README.md) and
[`requirements/_TEMPLATE.md`](../requirements/_TEMPLATE.md). Frontmatter maps the area
to a coverage feature + journey; each `## REQ-<AREA>-NN — <title>` block has
acceptance criteria, and **one criterion becomes one scenario**.

## Tag taxonomy

| Tag                                   | Level    | Purpose                                             |
| ------------------------------------- | -------- | --------------------------------------------------- |
| `@<feature>` (e.g. `@authentication`) | Feature  | product area → Allure epic/feature + coverage seed  |
| `@journey:<key>`                      | Feature  | maps to a `coverage-seed.yaml` journey              |
| `@req:<ID>`                           | Scenario | **requirement traceability** — the load-bearing tag |
| `@smoke` / `@regression` / `@wip`     | Scenario | severity / suite selection                          |

`fixtures/allure.fixture.ts` turns these tags into Allure labels automatically, so
the report groups by requirement, journey, feature, and severity with no per-test code.

## Traceability states (`coverage:requirements`)

- **✅ covered** — a scenario tagged `@req:<ID>` exists and passed
- **⚠️ failing** — a scenario exists but none passed
- **🟡 pending** — a scenario exists but hasn't run yet
- **❌ gap** — no scenario references the requirement

Output: `requirements-coverage.md` (matrix), Allure placeholders under a
**"Requirement gaps"** epic, a ranked console summary, and — in CI — the matrix in
the run's job summary. Gate a pipeline on it with `REQ_FAIL_ON_GAP=1`.

## Worked example

`requirements/REQ-AUTH.md` defines `REQ-AUTH-01…05`; `features/authentication.feature`
tags scenarios `@req:REQ-AUTH-01…04`. `REQ-AUTH-05` (forgot-password) has no scenario,
so it shows as a **gap** — proving the traceability catches uncovered requirements.

## Related

- [`docs/STARTER-DISPATCHER.md`](STARTER-DISPATCHER.md) — the dispatcher + stage 0 (source → requirements)
- [`docs/AGENT_ORCHESTRATION.md`](AGENT_ORCHESTRATION.md)
- [`requirements/README.md`](../requirements/README.md)
- [`test-data/coverage-seed.yaml`](../test-data/coverage-seed.yaml)
