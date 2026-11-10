# From a business specification to green tests

[spec-to-green.md](spec-to-green.md) starts from a requirement someone has already written.
This run starts one step earlier, where a customer usually is: with a product document. It
records what each stage produced, what a person had to decide, and what broke on the way,
because a pipeline that only works in the brochure is no use to anyone.

**Source:** the reference application's own help page,
[Quick Add Magic](https://vikunja.io/help/quick-add-magic). It describes typing details into
a task title: `Order packing supplies *logistics !3 tomorrow at 5pm` creates a task with a
label, a priority and a due date. **Result:** 12 requirements, 28 scenarios, and the 8
critical and high requirements covered against the running application. The other 4 are
gaps on purpose.

## The chain, stage by stage

| Stage        | Who                                                           | Input                                         | Output                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Extract   | `source-to-requirements` agent                                | the help page URL                             | [`requirements/QUICKADD.md`](../../requirements/QUICKADD.md): 12 requirements, every one traced to the page, 12 open questions flagged rather than guessed                |
| Review       | a person                                                      | the requirements file                         | a priority for each requirement, and the scope of this iteration (below)                                                                                                  |
| 1. Scenarios | `requirements-to-bdd` agent                                   | the reviewed file                             | [`features/quick-add-magic.feature`](../../features/quick-add-magic.feature): 28 scenarios, each tagged `@req:` with its severity, the lane tag and the report epic added |
| 2. Code      | Claude Code, in the session, verified against the running app | the scenarios and `bddgen`'s 21 missing steps | [`quick-add.steps.ts`](../../features/step-definitions/quick-add.steps.ts), one Page Object action, API helpers                                                           |
| 3. Trace     | `npm run coverage:requirements`                               | the run's results                             | 35/39 in the matrix, the strict gate passing                                                                                                                              |

Stage 2 was not done by the `playwright-test-generator` subagent: its browser tools were not
available to agents in this session. The code was written in the session and every step was
run against the application. The generator would do the same work with its own tools.

## What a person decided

The source never says which behaviour matters most, so the agent marked all 12 `normal` and
asked. Priority decides what CI enforces (an uncovered `critical` or `high` requirement fails
the gate), so it was ranked by **what the business loses when the behaviour breaks**:

- **critical:** the task is saved with a wrong title, or a wrong or missing due date, and
  nobody notices (due dates, due times, combined markers, the quoted-title escape);
- **high:** the task is saved but filed or flagged wrong (labels, project, priority, repeat);
- **normal / low:** a shortcut the user can replace by hand (assignees, multiline input,
  subtasks, the Todoist mode). These stay in the matrix as gaps for a later iteration.

That rule is now part of the agent brief and of `requirements/README.md`, so every customer's
requirements are ranked the same way.

## What broke, and what changed because of it

Each of these would have failed quietly in a customer engagement. All are fixed.

| Found                                                                                                                                                                                                        | Fix                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The agent briefs used `REQ-AREA-NN` with no priority line, so everything they extracted came out `normal` and the gate never enforced any of it                                                              | briefs follow `requirements/README.md`: three-digit IDs, a `**Priority:**` line with its reason                                                                                                                                                                                                                                                                                                                             |
| The scenario agent did not know that scenarios need the application's lane tag (`@app`); without it they run against the wrong application                                                                   | brief rule, and it then tagged correctly on its own                                                                                                                                                                                                                                                                                                                                                                         |
| A new feature tag with no entry in `EPIC_BY_TAG` drops out of the quality report's business-area view                                                                                                        | brief rule, and it added the entry on its own                                                                                                                                                                                                                                                                                                                                                                               |
| A `# TODO:` line in Markdown renders as a heading                                                                                                                                                            | TODOs are `> **TODO:**` notes                                                                                                                                                                                                                                                                                                                                                                                               |
| The scenario agent reused `I add the task`, which waits for a task with exactly the typed title. Quick Add stores a different title by design, so every scenario would have timed out                        | a Quick Add action that confirms submission by the field clearing; brief rule: read a step's assertions before reusing it                                                                                                                                                                                                                                                                                                   |
| "Tomorrow", "next Monday" and "the 17th" depend on the day the suite runs, and the browser's time zone                                                                                                       | `Given today is Wednesday 14 January 2026` fixes the browser clock, and the reference lanes run in UTC                                                                                                                                                                                                                                                                                                                      |
| Registering a second user mid-run hit the application's per-IP rate limit (HTTP 429)                                                                                                                         | the setup project provisions the accounts scenarios name                                                                                                                                                                                                                                                                                                                                                                    |
| Labels were missing from a saved task about one run in three. The failure trace showed the label request answered HTTP 500: Quick Add saves a task and its labels in parallel, and SQLite accepts one writer | **made rarer, not fixed.** One database connection and checks that poll the stored task cut it down. The server log later showed the real cause: the label write collides with Vikunja's own background notification write, and SQLite rejects it at once. No setting Vikunja exposes prevents that. It is a product defect, so the scenario keeps running and fails about one run in four (founder's decision, 2026-11-10) |

The last finding cost the most to find, and is the reason the trace is kept for every
failure. The symptom (labels missing, sometimes) pointed at the test. The first fix, one
database connection, made it rarer and looked like a cure for four clean runs. Running it
against a logged instance showed it was not: the defect is in the application on SQLite, and
the test is right to fail when it happens. A real user loses those labels too.

## Reproduce it

```bash
npm run setup
npm test
npm run coverage:requirements    # REQ-QUICKADD-*: 8 covered, 4 gaps
```

To run the extraction yourself, give the `source-to-requirements` agent the URL above and an
area name, then hand its output to `requirements-to-bdd`.
