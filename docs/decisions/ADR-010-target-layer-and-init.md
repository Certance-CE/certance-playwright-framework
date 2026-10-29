# ADR-010 — A separate target layer, and `npm run init`

**Date:** 2026-10-22
**Status:** Accepted
**Deciders:** Certance Lens architecture

---

## Context

The framework is sold as a template a customer adopts in an afternoon. That claim was never
tested, so we tested it: a fresh clone, pointed at an application it had never seen, with a
stopwatch running.

It failed at minute two. The README said to set `BASE_URL` to your application, and doing so
ended in `could not register a demo account (HTTP 405)`. Everything about the reference
application lived in the same `playwright.config.ts` as the framework core: the Vikunja web
server, the account provisioning, the lanes and the sign-in. A customer's engineer would have
had to find that boundary by hand, under time pressure, in front of the customer.

The same rehearsal surfaced three more problems that only a real retarget exposes:

- `npx playwright init-agents` crashes when the lane it seeds from no longer exists, so the
  customer's CI would go red in the Lint job on day one;
- the docs check crashes on a Markdown file that is tracked but has been deleted;
- the integrity gate (ADR-009) would have blocked the first pull request, because removing the
  demo's tests removes their assertions.

---

## Decision

**1. Split the configuration in two.** `playwright.config.ts` is the core: reporters,
timeouts, retries, the flake policy and the framework's self-tests. It does not know what it
tests. `app.config.ts` is the target: the base URL, how the application starts, and the lanes
that run against it. It exports a function rather than constants, so it reads the environment
after `.env` has loaded. `scripts/demo-layer.json` lists every file and script that belongs to
the reference target. CI calls npm scripts only (`setup:app`, `npm test`), so a new target
never needs a workflow edit.

**2. `npm run init -- --url <app> [--login <path>] [--name <name>]`.** It opens the
application without signing in, removes the files the manifest lists, and writes a scaffold:
`app.config.ts`, a Page Object, a smoke feature tagged `@smoke` and `@req:`, and
`requirements/SMOKE.md`. With `--login`, it reads the sign-in form and writes a `LoginPage`
whose locators were each verified to resolve to exactly one element, in golden-rule order
(role, label, placeholder, test id). A control with none of those gets a `TODO` test id and a
note, never a CSS selector. It then runs the suite.

**3. The first run needs no credentials.** The signed-in lanes are generated but switch on
only once `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are set. Until then they are left out
rather than failing, and the coverage matrix reports the sign-in requirement as `pending`, not
`covered`.

**4. `init` records why it removed the reference tests.** It writes a `governed-change:` note
into the diff. That is the same thing the integrity gate asks of a person, and it is true: the
removed assertions belonged to the demo applications.

---

## Rationale

The scaffold is deliberately small. It does not try to generate a test suite. That is the
planner and generator agents' job, working from requirements under human review. What `init`
generates is the part that has to be right before any of that works: the target, a verified
way in, and traceability from the first run. A generator that guessed more would be wrong more
often, and a wrong first impression at a customer costs more than a short one.

Probing the live sign-in form, instead of asking the engineer for selectors, is what makes the
locators trustworthy. They are verified against the real DOM at generation time, not typed
from memory.

---

## Evidence

Two rehearsals on applications the framework had never seen:

| Application                         | Path                                                            | Result                                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| saucedemo.com (hosted)              | `init --login /`, no credentials                                | **44 s** from `git clone` to green. All three sign-in locators found and verified (role, label, role).                               |
| A separately started local task app | `init --login /login`, then a throwaway local account in `.env` | **11 s** from `init` to a green signed-in run: `setup` signed in through the generated `LoginPage`, and the sign-in scenario passed. |

On the resulting pull request, lint, typecheck, check:docs, agents:sync, the unit tests, the
coverage matrix and the integrity gate all pass. The second rehearsal found that single-page
apps often give the sign-in button `type="button"` and put other buttons in the same form, so
the button is chosen by what it says before its HTML type. `unit/init.unit.test.ts` pins the
scaffold: it passes this repository's golden-rule lint, uses the verified locators verbatim,
never falls back to CSS, ties every scenario to a requirement, and carries the
`governed-change:` note.

---

## Alternatives considered

| Alternative                                      | Why rejected                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Better retargeting docs                          | The docs were already there, and they were wrong. Separation enforced by structure cannot drift the way a paragraph can. |
| A separate template repository without the demo  | The demo is the proof. A template that ships nothing runnable shows nothing, and two repositories drift.                 |
| A Yeoman-style interactive generator             | Prompts do not run in CI or in an agent, and add a dependency. Flags do both.                                            |
| Generate the login from the engineer's selectors | Locators typed from memory are the brittle ones. Verified against the live DOM, they are not.                            |

---

## Consequences

**Positive:**

- The template claim is now measured, not asserted: under a minute to the first green run
  against an unseen application, with every gate passing.
- The core/target boundary is a file boundary. A customer can see what is theirs to change.

**Negative / trade-offs:**

- The scaffold's "signed in" check is generic: the sign-in form has gone. It is true of every
  application, which is why it can be generated, and weaker than a check for something only a
  signed-in user sees. The generated comment says to replace it.
- Sign-in flows that are not a form (SSO redirects, MFA, magic links) are out of `init`'s
  reach. The worked example in `features/auth.feature` and `skills/core/auth.md` covers those
  by hand.

**Risks:**

- `scripts/demo-layer.json` must list every reference-target file. A file added to the demo
  and not to the manifest survives `init` and breaks the customer's first run. The rehearsal is
  the test for this, so rerun it when the demo layer changes.

---

## Extension — the API lane (2026-10-29)

`init` removed the reference API lane and put nothing in its place, so a customer started
with no API tests. `--api <url>` now takes a read-only endpoint (a health or info URL),
sends **one anonymous GET**, and writes an `api` lane, a contract test and
`requirements/API.md` tagged into the matrix. The rule is the same as for the sign-in
probe: read, never act. An endpoint that answers 4xx or 5xx is refused with an
explanation, not guessed at.

The contract holds the **types** the endpoint returned, never its values (a version string
changes every release), for at most twelve fields, with a comment naming how many were left
out. Nulls and arrays are `unknown`, because one sample cannot say what they hold later. The
schema is not `.strict()`: a field the provider adds passes, and a field dropped or retyped
fails. A non-JSON endpoint gets a status and content-type check.

Proven on two APIs `init` had never seen. A separate local instance of the task app
(`/api/v1/info`, 22 fields, 12 asserted) ran in one `init` with the sign-in probe, the
signed-in lane and performance: 25 s from clone to green, 4 of 4 requirements covered, and a
report titled for the app. Editing the generated schema to simulate the provider retyping one
field and dropping another failed with both fields named. GitHub's public API root
(33 fields, 12 asserted) was green.

---

## Review date

Revisit after the first customer `init`, against what it actually took.
