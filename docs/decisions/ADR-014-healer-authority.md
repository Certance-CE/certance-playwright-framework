# ADR-014: Hold the healer to locators on test defects

**Date:** 2026-11-11
**Status:** Accepted
**Deciders:** Certance Lens architecture

---

## Context

Triage (ADR-013) decides which failures an agent may touch: only those classed `test`, where the
test cannot reach the application's control. A decision nobody checks is advice, and the healer
has reasons to ignore this one. The stock Playwright healer brief, committed pristine by ADR-008,
tells it to fix "assertions and expected values", to mark a stubborn test `test.fixme()`, and to
"do the most reasonable thing possible to pass the test". A healer that obeys its own brief will
weaken tests.

The integrity gate (ADR-009) refuses a mute or a weakened assertion in any pull request, whoever
wrote it. It does not know which failures a healer was allowed to touch, or that a healer has no
business editing a feature file. A Gherkin `Then I see "3" tasks` changed to `"2"` passes it,
because the gate reads `expect(` lines and a feature file has none.

---

## Decision

`npm run heal:check` (`scripts/heal-check.js`) holds a healer's change to the run's triage. It reads
`test-results/triage.json` and the change (the working tree against `HEAD`, or a heal branch
against `HEAL_BASE`) and refuses it when:

| Rule             | Refused when                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| no triage        | there is no triage of the run: nothing is authorised (fail closed)                                                                      |
| nothing healable | no failure is a test defect; the product failures are listed as findings                                                                |
| out of scope     | a file other than `pages/` or a healable failure's own spec file changed: feature files, steps, requirements and config are all refused |
| assertion        | an `expect(` line is added, removed, or changed in what it claims                                                                       |
| muted            | a `.skip(` / `.fixme(` / `.only(` is added                                                                                              |
| waiver           | a `governed-skip:` / `governed-change:` note is added: a reason is a person's to write                                                  |

**What an assertion claims.** In this framework a Page Object often holds the locator inside the
assertion: `expect(this.page.getByRole('heading', { name })).toBeVisible()`. Repairing that
locator must be allowed, or the check blocks the honest heal it exists for. So an `expect(` line
may change its subject, the locator, provided its claim (the code before `expect(` and the whole
matcher chain after it, with its expected value) is identical. A changed matcher, value, timeout or
negation is a changed claim, and is refused.

The healer runs `heal:check` as its last step, against the triage of the run it healed; a refusal
means stop and report. `.claude/CLAUDE.md` says so and says that this rule wins where the stock
brief disagrees. Both Copilot healers (`.github/agents/`, which are ours, not upstream's) now run
triage first, change locators only, never `fixme`, and run the check.

---

## Rationale

The check is narrower and stricter than the gate on purpose. The gate governs every author and
lets a person through with a written reason. The healer is the one actor that changes tests
without a person writing the change, so it gets no waiver and a scope of one layer. That layer is
`pages/`, because the Page Object rule (golden rule 2) already puts every locator there.

---

## Alternatives considered

| Alternative                                           | Why rejected                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Rewrite the stock healer brief                        | ADR-008 keeps it pristine so upstream changes stay visible; a brief is also an instruction, not a control                           |
| Rely on the integrity gate                            | It does not know what triage authorised, and it does not read feature files                                                         |
| Refuse every change to an `expect(` line              | Blocks repairing a locator held inside an assertion, the common case in this framework's Page Objects                               |
| Map each healable failure to the Page Objects it uses | Not decidable from a diff; a failing step can reach any Page Object. The locator layer as a whole is the scope, and review reads it |
| Run the check in CI on heal branches now              | CI sees the healed run, which is green, so it has no triage to check against. That needs the heal to carry its record: provenance   |

---

## Consequences

**Positive:**

- The acceptance criteria of stage 08 hold, and are pinned against the real planted triage: a
  product regression is refused and reported as a finding, and a renamed control is repaired
  without the assertion changing.
- A healer cannot sign its own permit: the `governed-` notes that let a person through the gate are
  refused outright in a heal.

**Negative / trade-offs:**

- The check runs where the healer runs. CI enforces the gate on every pull request but cannot yet
  tell a healer's change from anyone else's. Provenance (the next part of the loop) gives a heal a
  record of the triage it acted on, and CI can then run this check on it.
- Repointing a locator inside an assertion keeps the claim but may change what it is about. That is
  the same power as repointing `this.add = …`, and the human review reads it.
- The integrity gate still does not read feature files, so a person or the generator changing a
  `Then` step's expected value passes it. The healer cannot (out of scope); closing it for everyone
  is a gate change, tracked separately.

**Evidence:** 26 unit cases over the real planted triage, and a live run against this repository's
own working tree; mutation score on the script 95.6%.

---

## Review date

Revisit when provenance lands (to run the check in CI on a heal), or when a customer's Page Objects
keep locators somewhere other than `pages/`.
