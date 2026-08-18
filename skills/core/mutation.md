# Mutation Testing (StrykerJS)

> Status: **Implemented** — `stryker.config.mjs` + vitest unit layer (`unit/`).

Load this guide when: assessing whether the tests actually catch bugs, hardening
the framework's own critical logic, or proving AI-generated tests have teeth.

---

## Why — coverage lies, mutation doesn't

Line coverage says which code _ran_, not whether a test would _notice a bug_. A
test can execute a line and assert nothing meaningful — "green but toothless."
**Mutation testing** injects deliberate defects ("mutants") — flips `>` to `>=`,
`??` to `&&`, deletes a line — and reruns the tests:

- test **fails** → mutant _killed_ ✅ (the tests caught it)
- tests still **pass** → mutant _survived_ ❌ (the tests are blind to it)

The **mutation score** (% killed) measures test _effectiveness_. For an AI-native
framework where the generator writes tests, this is the direct oracle for the #1
failure mode — a plausible-looking test that doesn't actually assert anything.

## Layout

- **`unit/`** — fast, browser-free **vitest** unit tests of the framework's PURE
  logic (validators, budget evaluation). This is the layer Stryker mutates.
- **`stryker.config.mjs`** — mutates the safety-critical pure modules, runs vitest,
  gates at **70%** mutation score.

```bash
npm run test:unit       # fast unit tests (vitest)
npm run test:mutation   # mutation testing → score + HTML report
```

The HTML report lands at **`reports/mutation/index.html`** — a per-mutant view
showing exactly which survived, so you know which assertions to strengthen. In CI
it's uploaded as the `mutation-report` artifact.

## Working the loop

Mutation testing is meant to _fail first_, then guide you:

1. Run it. Survivors point at weak assertions.
2. Strengthen the unit test to kill each survivor (assert the specific value/message,
   not just "it threw").
3. Re-run — the score rises. (The `contract.ts` suite went 65% → 90% this way.)

## Scope & extending

Mutation testing reruns tests per mutant, so it targets **fast, pure** code — not
full E2E (a browser rerun per mutant is impractical). Add modules to `mutate` in
`stryker.config.mjs` as they gain `unit/` tests. Keep Playwright E2E in `tests/`;
keep pure-logic unit tests in `unit/`.

---
