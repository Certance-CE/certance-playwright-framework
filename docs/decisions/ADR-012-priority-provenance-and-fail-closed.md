# ADR-012: Where a requirement's priority comes from, and failing closed without one

**Date:** 2026-11-10
**Status:** Accepted
**Deciders:** Certance Lens architecture, with the founder's ruling on provenance

---

## Context

A requirement's priority decides what CI enforces: the coverage gate fails an uncovered
`critical` or `high` requirement and only reports the rest (ADR-007). So whoever sets a
priority decides what the gate checks.

Two defects followed from that. The engine read any word after `**Priority:**` as a priority,
and defaulted a missing one to `normal`. A typo (`hihg`) or an agent that left the line out
switched the gate off for that requirement, and nothing said so. And there was no record of
**where** a priority came from: one the specification stated, one an agent guessed, and one a
person decided all looked the same in the file and in the matrix.

Two answers had been put forward. A plan from 22 October said agents must write `unset` and
never propose a priority. What shipped on 3 November had the extraction agent propose one by
business impact, with its reason, for a person to confirm. The founder's ruling: **it depends
on what the source gives the agent.**

---

## Decision

**1. The source decides what the agent writes.**

| The source…                                                                    | The agent writes                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| states the priority (a Jira priority, a "must have", a "shall")                | that priority, citing it: `<!-- source: … -->`                         |
| describes behaviour but does not rank it (product documentation, a user guide) | a proposal by business impact, with its reason: `<!-- proposed: … -->` |
| has no business context (an API reference, a technical specification, code)    | `unset`                                                                |

A person confirms or changes a priority by writing `<!-- decided YYYY-MM-DD: … -->`. A
priority line with no comment was written by a person and counts as decided. `npm run init`
writes its scaffold's priorities as proposals, so the customer confirms them.

**2. The engine fails closed.** A missing priority, `unset`, or a word the engine does not
know becomes `unset`, and `unset` gates as `critical`. A covered `unset` requirement passes;
an uncovered one fails.

**3. The matrix says what still needs a person.** The priority column shows provenance
(`critical (proposed)`, `high (source)`), and two lists follow the table: requirements that
need a priority, and proposals awaiting confirmation. A proposal is enforced as proposed until
then.

---

## Rationale

Provenance is the honest record of who decided what matters. A reviewer can tell at a glance
which priorities need real thought (proposals), which need a glance (from the source) and
which are done. Recording it costs one comment on a line that already exists, and the engine
can read it without a second file.

Failing closed is the governing invariant applied to the catalogue: an omission or a typo must
not weaken the gate. Gating an unset requirement as critical makes the omission visible in the
first run, where defaulting it to `normal` hid it for good.

---

## Alternatives considered

| Alternative                                                | Why rejected                                                                                                                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agents always write `unset`                                | Throws away a priority the source states, and gives a reviewer nothing to react to for a help page. The founder's ruling makes it the rule only where the source has no business context        |
| Agents always propose                                      | Invents business judgement from an API reference or code, where there is none to find                                                                                                           |
| Default a missing priority to `normal` (the old behaviour) | A typo or an omission silently switches the gate off                                                                                                                                            |
| Fail the gate on any `unset`, covered or not               | Blocks the first run of a customer's freshly extracted catalogue on bookkeeping rather than on risk. Gating it as critical already forces the decision before an uncovered requirement can pass |

---

## Consequences

**Positive:**

- Every priority in the matrix shows its provenance, and the matrix lists what a person still
  owes.
- An omission or a typo now fails visibly, in the first run.

**Negative / trade-offs:**

- A customer's freshly initialised repository shows its scaffold priorities as proposals until
  someone confirms them.

**Not decided here (open in the intent document):** guarding a lowered or deleted priority
with a recorded reason, and turning the requirement gate on in CI (`REQ_FAIL_ON_GAP=1`).

---

## Evidence

Eight unit cases in `unit/requirements-coverage.unit.test.ts`. Five of them fail against the
previous engine: no priority anywhere, a misspelt priority, an explicit `unset`, a proposal
listed for confirmation, a source priority labelled. Three pin unchanged behaviour: a covered
`unset` passes, a person-written `normal` only reports, a frontmatter default still applies.
The reference matrix is unchanged at 35/39.

---

## Review date

Revisit when a customer's source is something other than documentation (a Jira project, a
regulation), since that is where the `source` path is exercised for real.
