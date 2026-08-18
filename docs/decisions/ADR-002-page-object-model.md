# ADR-002 — Page Object Model as the sole abstraction layer

**Date:** 2026-01-15  
**Status:** Accepted  
**Deciders:** Certance Advisory architecture team

---

## Context

The framework needs a consistent pattern for how UI interactions are
abstracted from test logic. Without a clear pattern, selector duplication
and inconsistent maintenance patterns will emerge as the suite grows.

---

## Decision

Use the Page Object Model (POM) as the **only** abstraction layer between
test code (BDD steps / spec files) and the browser DOM.

Every page or significant UI component has exactly one Page Object class in
`pages/`. All `page.getByRole()`, `page.fill()`, and `page.click()` calls
are confined to these classes. Raw Playwright calls are **banned** in step
definitions and spec files.

---

## Rationale

POM is the most widely understood UI test abstraction pattern. It provides:

- Single location per selector — when the UI changes, only one file needs updating
- Action-level APIs — callers express intent, not implementation
- Testability — Page Objects can be tested in isolation
- Onboarding speed — new team members can read Page Objects to understand UI structure
- Compatibility with the Healer agent — the agent knows exactly where selectors live

---

## Alternatives considered

| Alternative                      | Why rejected                                                           |
| -------------------------------- | ---------------------------------------------------------------------- |
| Screenplay pattern               | More expressive but steep learning curve; slower onboarding            |
| Direct Playwright calls in steps | No abstraction — selector duplication, no single point of maintenance  |
| Fluent/chain API wrappers        | Adds complexity without significant readability benefit for this scale |

---

## Consequences

**Positive:**

- All selectors in one place per page
- Healer agent knows the exact files to update
- Step definitions read as prose — no browser API noise

**Negative / trade-offs:**

- Initial overhead of creating Page Objects before writing tests
- Risk of Page Objects growing too large — mitigate with component objects

**Conventions to enforce:**

- Methods are action-level: `submitForm()`, not `getSubmitButtonLocator()`
- Page Objects never navigate to other pages (except their own `navigate()`)
- Component Objects in `pages/components/` for reusable widgets

---

## Review date

Review if team size exceeds 10 QA engineers and the Screenplay pattern
becomes worth the learning investment.
