# ADR-011: The reference application is a real third-party app, run locally

**Date:** 2026-10-29 (records a choice made 2026-08-21, PR #10)
**Status:** Accepted
**Deciders:** Certance Lens architecture

---

## Context

A test framework has to be proven against something. Throughout, CI means the continuous-integration pipeline that runs on every pull request. What it is proven against decides what
the proof is worth: a page written by the same people who wrote the tests shows only that
they agree with themselves.

The choice was made in August and never written down, so it was being reopened: should the
framework be proven against a hosted product, a practice site, or an application Certance
builds for the purpose? This record settles it.

Three targets were tried before the current one:

| Target                                           | What happened                                                                                                                                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A hosted commercial SaaS product                 | Its sign-in is behind a CAPTCHA (a human-verification challenge), so no test can sign in unaided. The session had to be captured by hand, encoded into a CI secret and re-seeded whenever it expired. And CI depended on someone else's production service. |
| TodoMVC on its own                               | Runs anywhere, but has no sign-in, no API and too little behaviour to find a real defect.                                                                                                                                                                   |
| A hosted practice site built for test automation | It sits behind bot protection that challenges CI runners' IP addresses. The suite passed locally and failed in CI, and that only showed up in CI.                                                                                                           |

---

## Decision

**The reference application is Vikunja (v2.5.0, open source, GNU Affero General Public License 3.0), run locally.**
`npm run setup` fetches the pinned release (`scripts/fetch-app.js`), and Playwright's
`webServer` starts it with an empty database for every run (`app.config.ts`). The suite
provisions its own account over the API, signs in through the real form, tests the UI, the
API, the contract and page performance, then stops the application.

**TodoMVC stays as a second lane** (`bdd:chromium`): no sign-in, no download, proof that the
framework is not welded to one application.

**Certance does not build an application of its own to test.** Customers reach their own
application through `npm run init` (ADR-010), proven on applications the framework had never
seen.

---

## Rationale

- **A page structure (DOM) we did not write.** Locator discipline, the assertion floor and the contract checks
  only mean something against markup nobody tuned for them. Running against Vikunja found three
  real framework defects that a demo page could not have exposed: `data.unique()` colliding
  across parallel workers, a leading-slash request path silently answered by the single-page
  app's HTML, and clearing cookies not signing out because the token lives in `localStorage`.
  The contract lane also found a real inconsistency in Vikunja itself, which is now pinned by a
  characterisation test.
- **Local means deterministic.** No third party can rate-limit, block or change it between two
  runs. It works offline and behind a corporate proxy, and every run starts from an empty
  database.
- **Real enough to need the whole harness.** A sign-in, a session, a REST API, server-side
  state and a single-page frontend: everything a customer's application will ask of the
  framework.
- **No application of our own**, because it would cost weeks to build and keep maintaining, and
  it would persuade nobody. A buyer discounts a demo app built to be tested, for the same reason
  this record rejects one.

---

## Alternatives considered

| Alternative                          | Why rejected                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| A hosted commercial SaaS product     | A CAPTCHA at sign-in; manual session re-seeding; CI depends on a third party's production service. |
| A hosted practice site               | Bot protection blocks CI runners, so it fails only in CI.                                          |
| Build a Certance application to test | Weeks to build and maintain, and evidence a buyer rightly discounts.                               |
| TodoMVC alone                        | No sign-in, API or depth; kept as the portability lane.                                            |

---

## Consequences

**Positive:**

- The public suite is green on a fresh clone with no credentials and no hosted dependency.
- Every capability marked proven is proven against a running application.

**Negative / trade-offs:**

- `npm run setup` downloads about 47 MB, and the pinned version has to be upgraded on purpose.
- Vikunja stores data in SQLite, so the lanes that write to it run one worker at a time
  (`SERIALISED_WRITES` in `app.config.ts`). A customer's application with a real database does
  not have this limit.
- Vikunja rate-limits sign-in, so the lane order in `app.config.ts` is deliberate.

**Risks:**

- An unmaintained upstream would eventually force a change of reference application. The pin
  makes that a deliberate decision with a date on it.

---

## Review date

Revisit if Vikunja's upstream stops releasing, or when a Certance-owned service is mature
enough that testing it ourselves would add evidence rather than replace it.
