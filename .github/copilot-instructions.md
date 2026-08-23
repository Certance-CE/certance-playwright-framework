# Copilot workspace instructions

**Read [AGENTS.md](../AGENTS.md) in the repository root.** It is the single source of
instruction for every AI agent working here, and this file exists only to point
Copilot at it.

Keeping a second copy of the rules is how they drift: the previous version of this
file told agents to mock with `page.route()` and to import faker directly, both of
which the lint rules now reject. One file, one truth.

The essentials, if you read nothing else:

- Locators: `getByRole()` → `getByLabel()` → `getByTestId()`. No CSS, no XPath.
- Every UI interaction goes in a Page Object under `pages/`, injected via a fixture.
- Web-first assertions only. No `waitForTimeout`, no `networkidle`, no `force: true`.
- Mock through the `network` fixture; take test data from the `data` fixture.
- `npm run lint` enforces nine of the twelve golden rules — run it before you commit.
