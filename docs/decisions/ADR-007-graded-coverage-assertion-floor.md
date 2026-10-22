# ADR-007 — Coverage is graded evidence, not a boolean

**Date:** 2026-09-21
**Status:** Accepted
**Deciders:** Certance Lens architecture

---

## Context

The requirement traceability engine (`scripts/requirements-coverage.js`) graded a
requirement `covered` whenever a tagged test **passed**. It never inspected whether the
test **asserted** anything, and its optional gate ignored the `pending` state. Two failure
modes followed, both letting coverage look better than the evidence supports:

1. A scenario that passed but asserts nothing — a click with no `expect` behind it — read
   ✅ `covered`. The False Signal: a green test providing no protection.
2. A critical scenario that was muted (`@wip`) or otherwise never ran graded `pending`, and
   the gate did not fail on `pending`. Muting a test was cheaper than fixing it.

This is precisely the defect a Coverage Audit is sold to find in a client. It cannot live in
Certance's own tooling, and it contradicts the README's "traced to a passing test" claim.

---

## Decision

Coverage is a **graded claim about evidence**, not a covered/not boolean. A requirement
grades `covered` only when a tagged test **passed AND its bound steps assert something** —
checked by binding each Gherkin step to its step definition and following **one hop** into
any Page Object method the step calls, then looking for an assertion (`expect(...)`, an
`assert*()` method, or a Playwright matcher). A pass whose bound steps assert nothing grades
`structural`, not `covered`. The gate (`REQ_FAIL_ON_GAP=1`) fails any critical/high
requirement that is not `covered` — `gap`, `failing`, `pending`, or `structural` all fail.

The floor **understates, never overstates**: a requirement covered only by a plain spec (an
Allure label with no bound steps to inspect) stays `covered`, because there is nothing to
prove it does not assert.

---

## Rationale

The framework's whole thesis is evidence over green. An engine that a muted or empty test can
green is the same lie the product exists to expose. The one-hop Page Object follow is
required because the golden rules put assertions *in* Page Objects, so a floor that only saw a
step body's `expect(` would grade the framework's own correct architecture as `structural`.
Understating rather than overstating keeps the floor honest: it can only make a grade weaker,
never stronger, so it can never manufacture a false `covered`.

Proven: `unit/requirements-coverage.unit.test.ts` pins the behaviour (a green-but-empty test
grades not-covered; a Page Object assertion one hop away still counts; an Allure-label-only
cover still counts; a skip is not a pass; a genuine gap fails the gate), and the real suite is
unchanged at 25/25 covered — now because assertions were found, not merely because tests
passed. Shipped in PR #51.

The seven-grade model, waivers, and `verified` hashes remain in the private monorepo; this
public engine ports only the minimal honesty fix.

---

## Alternatives considered

| Alternative | Why rejected |
| ----------- | ------------ |
| Keep the boolean, document the caveat | The README claim is falsifiable in two minutes; a documented lie is still a lie. |
| Run coverage tools (Istanbul/line coverage) | Line coverage counts code that ran, not behaviour asserted — the same false signal at a different layer. |
| Port the full seven-grade model from the private repo | Overkill for the public honesty fix, and it exposes moat the private monorepo keeps (§8). |
| Grade on the test *name* claiming a check | The name is a promise the body may not keep; treating it as evidence is the False Signal itself. |

---

## Consequences

**Positive:**

- The matrix is evidence: `covered` now means passed-and-asserting.
- Muting or emptying a test can no longer sneak a critical requirement past the gate.
- The behaviour is pinned by red-first unit tests, so it cannot silently regress.

**Negative / trade-offs:**

- The assertion check is a text-level floor (regex over bound bodies), not a semantic proof;
  a genuinely-asserting test written in an unrecognised shape could grade `structural` until
  the pattern set is widened. This is the safe direction (understate).
- One hop only: an assertion two Page Object calls deep is not followed, and grades
  `structural`. Deeper indirection is discouraged anyway.

**Risks:**

- A future Playwright matcher not in the `ASSERTION` set would be missed until added.

---

## Review date

Revisit if the assertion set needs frequent extension (signals the regex floor should become
an AST check), or when the public engine is reconciled with the private seven-grade model.
