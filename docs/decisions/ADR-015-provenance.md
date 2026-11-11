# ADR-015: Every change to what the suite checks says who wrote it

**Date:** 2026-11-11
**Status:** Accepted
**Deciders:** Certance Lens architecture; scope decided by Ivan Stepantsov (2026-11-11)

---

## Context

The Governed Loop asks, of every change to the tests: which agent made it, from what input,
under which tool version, and did a person review it. It also asks for the share of the suite
an agent wrote and the share a person reviewed, and it says to fail closed when the answer is
unknown. Nothing recorded any of this. A pull request that changed a test looked the same
whether a person, the generator or the healer wrote it.

It also left a gap in ADR-014. The heal check needs the triage of the failing run, and CI only
sees the healed run, which is green. So CI could not hold a heal to the healer's authority.

**Scope (Ivan's decision).** Fail closed only where it protects something: commits that change
what the suite checks. Dependency bumps, docs and config carry no extra step.

---

## Decision

A commit that changes a **governed path** (a test lane, `pages/`, `features/` including step
definitions, or `requirements/` other than its README) carries a commit trailer:

```
Provenance: human
Provenance: agent=playwright-test-healer; input=provenance/heal-….json; tool=@playwright/test@1.65.0
```

`npm run provenance` runs on every pull request, over its commits (merges excluded), and fails when:

| Rule       | Fails when                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unknown    | a governed commit declares nothing. It is counted as agent-written: the reading that asks for more scrutiny                                                     |
| incomplete | an agent's declaration lacks its agent, input or tool                                                                                                           |
| heal       | a healer's commit does not commit the triage it acted on as `provenance/*.json` and name it in `input=`, or `heal:check` refuses the commit against that record |

It reports, for the governed commits, the share agent-authored and the share reviewed by a person,
and of the agent-authored, the share reviewed. A commit is reviewed when it carries a `Reviewed-By:`
trailer or the pull request has an approval from someone other than its author. The report goes to
`provenance.md` and the CI summary.

`npm run provenance -- record` is the healer's last step: it copies the run's triage into
`provenance/heal-<time>.json` and prints the trailer. The record is evidence: `heal:check` admits it
to a heal and does not read its contents as code.

Agents write `agent=…`, and never `human` or `Reviewed-By:` (`.claude/CLAUDE.md`, both Copilot
healers).

---

## Rationale

Commit trailers are already where this repository records authorship (`Co-Authored-By:`). They
travel with the commit, every Git host shows them, and they need no server or database. A record
file for a heal, rather than a hash of a triage that lives elsewhere, is what lets CI rerun the
heal check with nothing but the pull request.

---

## Alternatives considered

| Alternative                                          | Why rejected                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Every pull request declares provenance               | Ivan's decision: it taxes dependency and docs changes that cannot weaken a test                                                             |
| Infer the agent from `Co-Authored-By:`               | It names a model, not the agent, its input or the tool version; inferring would also make a missing declaration pass                        |
| Treat unknown as human                               | The opposite of fail closed: the least-checked reading for the least-known change                                                           |
| Require a person's approval on agent-authored change | The loop's GATE 1 says so, but it is a branch-protection policy for each customer; the share is reported, and blocking is theirs to turn on |
| Signed commits per agent                             | Stronger, and the right hardening for a regulated customer; it needs keys per agent that a template cannot ship                             |

---

## Consequences

**Positive:**

- CI now holds a heal to the healer's authority from the pull request alone. The gap ADR-014 named
  is closed, proven on real commits: an unmarked test change fails, a heal against a test-defect
  triage passes, and the same heal against a product-only triage is refused.
- Agent-authored and reviewed shares are a number per pull request, not a claim.

**Negative / trade-offs:**

- A trailer is a declaration. An agent that ignored its brief could write `Provenance: human`. The
  brief forbids it and review reads it; signed commits would make it a control.
- A person changing a test must add `Provenance: human`; the failure message says exactly what to add.
- The reviewed share counts an approval on the pull request as review of every commit in it.

**Evidence:** 19 unit cases, including heals checked against the real planted triage; a live run on
real commits in a scratch clone, which also found a defect the unit tests missed (the record's
failure text contains `expect(`, which the heal check read as assertions; fixed, and pinned).

---

## Review date

Revisit when a customer needs signed provenance, or when the evals (the loop's last part) report
per-agent results that this record should carry.
