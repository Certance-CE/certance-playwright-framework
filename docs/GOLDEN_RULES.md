# The golden rules — what enforces what

The framework states twelve rules (`skills/SKILL.md`). Claiming they are all
"machine-enforced" would be false, so this page says precisely which mechanism
holds each one up.

**Nine of the twelve are enforced by lint.** The other three are not statically
decidable, and no amount of configuration changes that — they are named here as
review or CI concerns rather than quietly counted as enforced.

Every lint rule below is itself tested in `unit/golden-rules.unit.test.ts`: each is
run against code that should break it, so a rule that stops firing fails the build.
A claim of enforcement that nothing checks is the thing this page exists to prevent.

| #   | Rule                                              | Enforced by           | Mechanism                                                                                                                                                                              |
| --- | ------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Locators — `getByRole`/`getByLabel`/`getByTestId` | **Lint**              | bans `.locator()`, `page.$`, `page.$$`; text locators outside `pages/`                                                                                                                 |
| 2   | All UI interaction in Page Objects                | **Lint**              | bans `page.click/fill/press/...` in test code                                                                                                                                          |
| 3   | Fixtures over `beforeEach`                        | **Lint**              | bans `test.beforeEach` / `test.beforeAll` in test code                                                                                                                                 |
| 4   | Test independence                                 | **Lint (proxy) + CI** | bans serial mode and module-scoped `let`/`var`; CI runs the suite shuffled under three seeds (`npm run test:shuffled`)                                                                 |
| 5   | Web-first assertions, no escape hatches           | **Lint**              | `no-wait-for-timeout`, `prefer-web-first-assertions`, `missing-playwright-await`, `no-force-option`, `no-element-handle`, `no-eval`, `no-networkidle`, `valid-expect`, `expect-expect` |
| 6   | Third parties mocked at the network layer         | **Lint**              | bans raw `page.route()` — use the `network` fixture                                                                                                                                    |
| 7   | Synthetic data only, never real PII               | **Lint**              | bans literal email addresses and direct `faker` imports                                                                                                                                |
| 8   | One scenario per test                             | _Review_              | not decidable — see below                                                                                                                                                              |
| 9   | Trace reviewed before committing                  | _Config + review_     | `trace: 'retain-on-failure'` is configured; reviewing it is a habit                                                                                                                    |
| 10  | Healer owns locator fixes                         | **Gate + check**      | `gate:skips` blocks a mute or a weakened assertion in any diff; `triage` + `heal:check` hold the healer to locators on `test` failures — see below                                     |
| 11  | Page Objects injected, never `new`ed              | **Lint**              | bans `new SomethingPage(...)` in test code                                                                                                                                             |
| 12  | Application-agnostic core                         | **Lint**              | bans `pages/`/`features/` imports **and** application names in `utils/` and `fixtures/`                                                                                                |

## Why three are not lint rules

**#8 — one scenario per test.** "One scenario" is a claim about meaning, not syntax.
A test with six assertions may be one scenario thoroughly checked; a test with two
may be two scenarios glued together. Counting `expect` calls would punish the first
and miss the second, so the rule stays a review question.

**#9 — trace reviewed before committing.** The configuration half is real and
enforced: traces are retained on failure. Whether a human opened one is not a
property of the code, and a lint rule that pretended otherwise would be theatre.

**#10 — healer owns locator fixes.** Enforcing this needs to see a _diff_: a test
newly skipped, an `expect` removed, an assertion literal changed in a file the healer
touched. A linter sees one file at a time with no history, so this is enforced at the
diff instead, in three parts:

- the integrity gate (`npm run gate:skips`, ADR-009) refuses a mute or a weakened
  assertion in any pull request;
- triage (`npm run triage`, ADR-013) decides which failures are test defects;
- `npm run heal:check` (ADR-014) refuses a healer's change that touches anything
  but locators, or any failure that is not a test defect.

The heal check runs where the healer runs, against that run's triage. CI does not yet
see which change a healer made; that comes with provenance.

## Two deliberate exceptions

Both are tested, so neither can widen unnoticed:

- **`framework-tests/` may order itself.** `cleanup.spec.ts` proves teardown runs
  after a _failing_ test, which is inherently ordered. Rule 4 is about tests of an
  application; a self-test of the framework's own ordering behaviour must be able to
  order. Every other rule still applies there.
- **Setup projects may construct a Page Object.** `tests/*.setup.ts` runs before any
  fixture exists — it is what creates the session the fixtures later inject. Rule 11
  is lifted there and nowhere else.

## A trap worth knowing

`no-restricted-syntax` does **not** merge across ESLint config blocks: a later block
matching the same file _replaces_ the earlier selector list rather than adding to it.
Add a block carelessly and rules 1 and 2 switch off silently, with lint still green.

`eslint.config.mjs` composes the lists from named constants for that reason, and
`unit/golden-rules.unit.test.ts` ends with a regression test asserting that rules 1
and 2 still fire alongside the newer ones.
