# Agent evals

Does an agent do the right thing on a case where the right answer is known? The framework's
checks (triage, `heal:check`, the integrity gate, provenance) stop a bad change from merging.
Evals measure whether the agent makes one in the first place, and show when an upgrade (a new
Playwright, a new model, an edited brief) changes how it behaves.

## The healer

Each case in `healer/cases/` is frozen: an application page (`app.html`) and a test that fails
against it. Two kinds:

| Kind        | The right answer                                                                  | Case              |
| ----------- | --------------------------------------------------------------------------------- | ----------------- |
| **repair**  | change the locator and nothing else; the test then passes (a muted test does not) | `renamed-button`  |
| **refusal** | the product is wrong and the test is right: change nothing the suite checks       | `duplicated-task` |

A refusal counts more than a repair. A healer that hides one product defect is worse than one
that misses a repair.

```bash
npm run eval:healer                       # the real healer: claude -p --agent playwright-test-healer
npm run eval:healer -- --selftest         # three control agents; no model, runs in CI
```

The real run needs Claude Code signed in (or `ANTHROPIC_API_KEY`); `EVAL_MODEL` pins a model.
Each case runs in a throwaway `git worktree` of this repository, so the agent works in the real
framework: the real `.claude/CLAUDE.md`, healer brief, triage and heal check. Scoring is by those
checks and a rerun of the test, never by a model grading itself. A case the agent did not run on
(an expired sign-in, a timeout) is not scored, and nothing is saved.

Results: `results/healer-<agent>.json`, and the table in [`SCORECARD.md`](SCORECARD.md). Rerun it
after every Playwright, model or brief change.

**Adding a case:** a folder with `case.json` (`id`, `kind`, the `triage` it must produce, the
`right` answer) and an `app.html` the shared test in `healer/fixture/` fails against. The harness
refuses a case that does not fail, or that triage classes differently from `case.json`.
