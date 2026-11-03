# requirements/

The requirement catalogue. Each `REQ-<AREA>-<NNN>` heading is one requirement; a
scenario or spec claims it with a `@req:` tag, and `npm run coverage:requirements`
produces `requirements-coverage.md` from the catalogue, the tags, and the results of
the run that just happened.

```bash
npm run coverage:requirements          # report
REQ_FAIL_ON_GAP=1 npm run coverage:requirements   # fail on an uncovered critical/high
```

## What the percentage means, and what it does not

The matrix reports **35/39**: every critical and high requirement written down here is
covered, and four normal or low ones in `QUICKADD.md` are deliberate gaps, left for a later
iteration. Even a full matrix is **not** a claim that the application is fully tested, and
the distinction matters more than the number.

The reference application has teams, sharing, kanban boards, saved filters, reminders,
attachments and more. None of that is catalogued, so none of it
appears as a gap. A requirement that has never been written cannot show up as missing,
which is the honest limitation of every traceability matrix ever produced.

So read it as: _of the behaviour this project has committed to, all of it is covered._
A full matrix is a floor, not a ceiling.

## Recording a gap on purpose

When something is deliberately untested, write the requirement anyway and leave it
without a scenario. It then appears as `❌ gap` with its priority, which is the point:
the matrix should show the real edge of coverage, not the edge of what was convenient.

A gap with a reason is a decision. A gap with no requirement is an oversight nobody
will ever find.

## Ranking: business-critical first

Priority decides what CI enforces: an uncovered `critical` or `high` requirement fails the
gate, the rest are reported. Rank by what the business loses when the behaviour breaks:

- **critical**: data is saved or shown wrong, silently, or a person is blocked from a core
  journey;
- **high**: the journey completes, but its result is filed, flagged or routed wrong;
- **normal**: a convenience the person can reach another way;
- **low**: a convenience the requirement does not fully define.

## Adding one

1. Add a `## REQ-AREA-NNN — Title` heading with a `**Priority:**` line to the relevant
   file, or create a new file with `epic`, `journey` and `priority` frontmatter.
2. Tag the scenario `@req:REQ-AREA-NNN`, or the spec
   `{ tag: ['@req:REQ-AREA-NNN'] }`. Both are recognised.
3. Run the suite, then `npm run coverage:requirements`.

Coverage means a claiming test **passed** in that run. A requirement whose test failed
reports `⚠️ failing`, not `✅ covered` — a matrix that counted intent rather than
results would be worse than none.
