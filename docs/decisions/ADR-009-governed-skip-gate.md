# ADR-009 — The governed-skip integrity gate

**Date:** 2026-09-21
**Status:** Accepted
**Deciders:** Certance Lens architecture

---

## Context

The governing invariant of the framework's agent loop is: **no automated action may reduce
the suite's ability to detect a defect.** A weakened test is worse than a failing one because
it is silent. Playwright's own healer defines success as "a passing test, or a **skipped**
test if the healer believes functionality is broken" — which, ungoverned, converts a real
defect into a green build, and nobody signed off because nobody was asked. The framework's
healer brief is likewise allowed to reach for `test.fixme()`, and `eslint`'s
`no-skipped-test` is off by design (a conditional `test.skip` is legitimate).

Nothing in CI caught a newly-muted test. This is the first slice of the Governed Loop's
integrity gate (GATE 2): CI inspects the diff and fails the PR.

---

## Decision

A CI gate (`scripts/governed-skip-check.js`, `npm run gate:skips`) reads the pull request diff
and **fails when a test lane** (`tests/`, `specs/`, `framework-tests/`,
`features/step-definitions/`) **gains a `.skip` / `.fixme` / `.only` that carries no recorded
reason.** A genuine skip is allowed by an **inline `governed-skip:` note** on the same line:

```ts
test.fixme('rejects an invalid card', async () => { // governed-skip: APP-123 broken upstream
```

The gate reads **added lines only**, so unmuting a test is always allowed. It **fails closed**
(an unwaived mute fails), and the override is **recorded and attributable** (it lives in the
diff, next to the code, where a reviewer sees it and an agent cannot add it silently). It runs
in the CI unit job, which already checks out full history. BDD scenario muting (`@wip`) is
governed separately: the coverage gate (ADR-007) grades a never-run scenario `pending`, which
is not `covered`.

---

## Rationale

The inline-reason waiver was chosen deliberately over a central waivers file: it is the
least-friction override that still leaves a record (a painful gate gets disabled entirely),
and it keeps the reason with the code rather than in a second place that rots. Fail-closed on
unknown provenance is the point — an agent optimising for green must not be able to mute a
test without a human writing down why.

Proven: `unit/governed-skip.unit.test.ts` (6 cases) pins that the gate fails an unwaived
`fixme`/`.only`, passes a waived one, ignores non-test files, and ignores removals; the CI
step is verified to run and pass on a clean PR. Shipped in PR #55.

`unit/` (the framework's own vitest logic) is deliberately outside the guarded lanes: it is a
different layer (mutation-tested), and guarding it would false-positive on this gate's own
fixture strings.

---

## Alternatives considered

| Alternative | Why rejected |
| ----------- | ------------ |
| Turn on `eslint`'s `no-skipped-test` | Too blunt: it bans every skip including legitimate conditional ones, and it is not diff- or provenance-aware. |
| Central waivers file with expiry | More ceremony per skip, a second place to edit, and the reason lives away from the code. Kept as a possible future for auditability. |
| Block all skips, no waivers | Blocks legitimate "this feature is genuinely broken, skip for now" cases and gets the gate disabled out of frustration. |
| Trust the human review gate (GATE 1) alone | A review can miss a one-line `test.fixme`; the invariant deserves a machine backstop. |

---

## Consequences

**Positive:**

- An agent (or a person) can no longer silently mute a failing test — CI fails without a
  recorded reason. This is the differentiator artefact: "your AI just disabled a failing
  test, who signed off?"
- The waiver is auditable: every allowed skip carries a reason in the diff.

**Negative / trade-offs:**

- This slice covers `skip`/`fixme`/`.only` only. The other forbidden healer actions —
  removing an assertion, changing an asserted value — are not yet caught (fixed waits are
  already caught by lint). Those are a follow-on extension of the same gate.
- The pattern match is textual: a `.skip(` inside a string literal in a guarded file would
  need a waiver. Acceptable for a floor; rare in practice.

**Risks:**

- The diff base in CI relies on `github.event.pull_request.base.sha` and a full-history
  checkout; a workflow change that shallows the unit job would break the range.

---

## Review date

Revisit when extending the gate to assertion-removal / value-change (completing GATE 2), or if
the textual match produces false positives often enough to warrant an AST-based check.
