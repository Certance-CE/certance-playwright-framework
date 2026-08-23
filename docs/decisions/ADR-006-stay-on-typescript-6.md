# ADR-006 — Stay on TypeScript 6 until typescript-eslint supports 7

**Date:** 2026-08-23
**Status:** Accepted
**Deciders:** Framework maintainers

---

## Context

TypeScript 7.0 shipped, and the framework was caret-locked at `^6.0.3`. Upgrading
looked like routine hygiene: a major version behind on the language a TypeScript
framework is written in is not a good look for a repository that argues for currency.

The upgrade was attempted, and it works — `tsc --noEmit` passes cleanly on 7.0.2 once
`moduleResolution: node10` is replaced (it is removed in 7.0, not merely deprecated).

Then `npm run lint` fails to start at all:

```
typescript-eslint does not support TS 7.0.
See https://github.com/typescript-eslint/typescript-eslint/issues/10940
```

Not a warning, and not a subset of rules degrading. The plugin refuses to load, so the
entire lint step exits non-zero before evaluating a single file.

## Decision

**Remain on TypeScript 6 until `typescript-eslint` supports TypeScript 7.**

Keep the two improvements the attempt surfaced, both of which are valid on 6:

- `module: "preserve"` instead of `moduleResolution: "node10"` plus
  `ignoreDeprecations: "6.0"`. Bundler-style resolution is what Playwright's loader
  actually does, and it removes a setting that 7.0 deletes outright — so the eventual
  upgrade is smaller.
- `framework-tests/**` and `unit/**` added to `include`. Neither was type-checked.
  `unit/` never had been; `framework-tests/` fell out of coverage when those files
  moved there. Verified by planting a deliberate type error in each: before, `tsc`
  exited 0; after, both are reported.

## Rationale

Nine of the twelve golden rules are enforced by ESLint. It is the mechanism that makes
"opinionated" mean something a build can check rather than something a document
asserts. Upgrading the compiler at the cost of that gate trades the framework's
central claim for a version number.

The alternatives were considered and rejected:

- **Run typescript-eslint against a side-by-side TypeScript 6 API.** Supported by
  Microsoft's migration guidance, but it means two compiler versions resolving
  differently, and a reference implementation should not model that.
- **Disable the typescript-eslint rules and upgrade anyway.** This is the trade stated
  above, made silently.
- **Pin and forget.** Rejected because the reason would be invisible to the next
  person, who would attempt the same upgrade and hit the same wall.

## Consequences

**Easier:** lint keeps working; the golden-rule enforcement is untouched; the
`tsconfig` is already free of the settings 7.0 removes, so the upgrade becomes a
one-line change once the plugin lands.

**Harder:** the repository sits one major version behind, and the reason is a
transitive constraint rather than a choice about TypeScript itself. Anyone auditing
dependency currency will flag it, and this ADR is the answer.

**Revisit when:** typescript-eslint announces TypeScript 7 support
(issue #10940). The change is then `typescript@^7` plus a `npm run lint` run.
