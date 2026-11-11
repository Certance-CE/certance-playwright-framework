# ADR-013: Classify every failure before anything touches it

**Date:** 2026-11-11
**Status:** Accepted
**Deciders:** Certance Lens architecture

---

## Context

The Governed Loop (stage 07) requires every failure to be classified before any remediation:
a product defect, a test defect, an environment problem or a flake. Without it, the only
question a healer can ask of a red test is "how do I make it green?", and the cheapest answer
is to weaken the test. The integrity gate (ADR-009) stops the weakening at the pull request;
triage stops the healer reaching for it in the first place, because it decides which failures
an agent may touch at all.

The suite already produced the evidence: Playwright's JSON report carries each failure's
message, and the messages are specific (a strict-mode violation, an element not found, an
expected and a received value, a refused connection). Nothing read them.

---

## Decision

`npm run triage` (`scripts/triage.js`) reads `test-results/results.json` after every run and
puts each failed or flaky test in one class, by ordered rules over the failure text:

| Class          | Evidence                                                                                       | Healable                     |
| -------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| `product`      | an expected and a received value on an element that was found; a 5xx; API contract drift       | no: a finding                |
| `test`         | a locator that matches several elements, or matches nothing                                    | **yes, and nothing else is** |
| `environment`  | a refused or unresolved connection, a rate limit, a rejected session, a page that never loaded | no: rerun                    |
| `flake`        | failed, then passed on retry                                                                   | no                           |
| `unclassified` | no rule decided it                                                                             | no                           |

Each result carries a confidence (high where the evidence decides it, medium where two readings
remain, and the reason names the other reading) and the evidence line. It is written to
`test-results/triage.json`, to `triage.md` (product defects first, as findings), to the CI
summary, and into the quality report. It is report-only and never changes the build's result.

**Fail-safe by construction.** Every ambiguous case falls away from `test`, the only class that
permits an automated change. A value mismatch is `product` even though the expectation might be
the stale side: a person decides, and the healer never does. A wrong guess can therefore stop a
fix; it cannot weaken a test.

---

## Rationale

Rules over the failure text. The classes the healer's authority depends on must
be deterministic and reviewable, and the text Playwright writes is specific enough. The rules
were written against real output: ten failures planted one per class and run through
Playwright, kept as the frozen fixture `unit/fixtures/triage/planted-results.json`.

---

## Alternatives considered

| Alternative                                                            | Why rejected                                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An LLM classifies failures                                             | It would be neither deterministic nor reviewable, and it sits upstream of what an agent is allowed to change; the evidence is specific enough for rules |
| Classify only in the healer                                            | The healer would grade its own permission to act                                                                                                        |
| Treat an assertion mismatch as a test defect when the locator resolved | Makes "change the expected value" healable, which is exactly the weakening the loop forbids                                                             |
| Fail the build on a product defect                                     | The build already fails on the failing test; triage explains, it does not add a second verdict                                                          |

---

## Consequences

**Positive:**

- A healer has a machine-readable answer to "may I touch this?", and the answer is no unless
  the failure is a test defect.
- A product defect is reported as what it is, at the top of the triage and in the quality
  report, which is the Governed Loop's requirement that catching a bug be as visible as a green
  run.

**Negative / trade-offs:**

- A removed control and a drifted locator look the same (`element(s) not found`). Triage says
  `test` with medium confidence and names the other reading; a person confirms before healing.

**Evidence:** 56 unit cases, against the planted run and against real failures from this
repository's history: the Quick Add label loss (a Vikunja-on-SQLite defect) is `product`, the
mid-run session expiry (ADR-012's sibling finding, `skills/core/auth.md` section 5) is
`environment`. Mutation score on the script: 82.7%, the survivors being regex-anchor variants
no realistic message distinguishes.

---

## Review date

Revisit when the healer's authority is enforced in CI (Governed Loop stage 08), or when a
customer's failures produce a class of message these rules do not cover.
