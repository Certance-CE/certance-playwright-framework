# Spec to green in five minutes

You write a requirement in plain language. The framework turns it into a
business-readable scenario, an AI agent writes the test code against your live
application (verifying every locator as it goes), you review it, and it runs green,
traced in a coverage matrix that says "covered" only when the test actually asserts
something.

That is the whole framework in one loop: spec-driven, low-code, AI-assisted, and honest
about what it proves. This page walks the loop with a real worked example
(`REQ-TODO-006`, already in the repo), then hands it to you.

## Once, per machine

```bash
git clone https://github.com/Certance-CE/certance-playwright-framework.git
cd certance-playwright-framework
npm install
npm run setup      # fetches a browser and a small real app
npm test           # green on a cold clone, no credentials
```

Open the repo in Claude Code or VS Code. [`.mcp.json`](../../.mcp.json) wires Playwright's
test MCP and [`.claude/agents/`](../../.claude/agents) carries the agents. There is nothing
else to configure.

## The loop, per requirement

### 1. Write the requirement (plain language)

Add a block to a file under `requirements/`. The worked example added this to
[requirements/TODOS.md](../../requirements/TODOS.md):

```markdown
## REQ-TODO-006 — All todos can be completed at once

**Priority:** normal

The "Mark all as complete" toggle completes every todo in the list in a single
action, so a user closing out a finished list does not have to tick each item.
```

### 2. Generate the scenario

Ask the [requirements-to-bdd](../../.claude/agents/requirements-to-bdd.md) agent to turn the
requirement into a tagged scenario. It writes business-readable Gherkin, one scenario per
criterion, tagged for traceability, with no selectors and no code:

```gherkin
@regression @req:REQ-TODO-006
Scenario: Complete all todos at once
  Given I have added the todo "Wash the car"
  And I have added the todo "Walk the dog"
  When I mark all todos complete
  Then the todo "Wash the car" should be completed
  And the todo "Walk the dog" should be completed
```

This is the low-code surface: a person who does not write TypeScript can read, review, and
even author this.

### 3. Generate the test code, against the live app

Run `npm run bdd:gen`, then ask the
[playwright-test-generator](../../.claude/agents/playwright-test-generator.md) agent to
implement the one new step. It drives the real application in a browser, verifies the
locator against the live DOM, and writes the code from what actually worked; it does not
guess a selector. Here it produced one Page Object method in
[pages/TodoPage.ts](../../pages/TodoPage.ts):

```typescript
async markAllComplete() {
  await this.page.getByLabel('Mark all as complete').click();
}
```

and one step in
[features/step-definitions/todos.steps.ts](../../features/step-definitions/todos.steps.ts):

```typescript
When('I mark all todos complete', async ({ todoPage }) => {
  await todoPage.markAllComplete();
});
```

The locator is `getByLabel(...)`, not a CSS selector. The golden rules are lint-enforced, so
a brittle selector would fail the build, and the generator verified this one against the
running app before it wrote the code.

### 4. Review (the gate)

Read the generated test and ask one question: would it fail if the behaviour broke? Here it
would, because the scenario asserts that each todo is completed, not merely that the click
happened. An agent proposes; a human disposes. This step is not optional, and it is where a
hallucinated assertion is caught.

### 5. Run

```bash
npm run bdd:test
```

```
✓ Complete all todos at once @todos @regression @req:REQ-TODO-006 (1.1s)
7 passed
```

### 6. Trace

```bash
npm run coverage:requirements
```

```
Requirement coverage: 25/25 (100%)
| REQ-TODO-006 | All todos can be completed at once | normal | "Complete all todos at once" | ✅ covered |
```

`REQ-TODO-006` is `covered`, and it is covered honestly. The engine grades `covered` only
when a tagged test passed **and** its bound steps assert something; a green test that
asserted nothing would grade `structural`, not covered. The matrix is evidence, not a number
that flatters everyone.

## What that demonstrated

- **Spec-driven** — the requirement is the source of truth, traced to a passing, asserting test.
- **Low-code** — you wrote a requirement and read a plain-language scenario; the agent wrote the TypeScript.
- **AI-assisted, and yours** — the agent generated the code against your live app; your engineer reviewed and owns it.
- **Harness already there** — lint enforced the rules, the coverage engine graded honestly, and nothing needed configuring.
- **Fast** — minutes, against a real application, on a cold clone.

## Your turn

Add a requirement of your own, a behaviour you care about, and run the same six steps. To
point the whole thing at your application instead of the demo, set `BASE_URL` and replace
`pages/` and `features/`; the core does not change.

## Honest notes

- Steps 2 and 3 (the agents) run **in your editor** (Claude Code, or VS Code with the
  Playwright MCP), not in headless CI. That is the point: your engineers, in your tools.
  [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md) states the rules the agents work under.
- The generator verifies every locator against the live DOM. A locator that was not grounded
  that way is not acceptable.
- The healer may replace a locator that drifted, but never weakens or skips a test to make it
  pass. A real regression is surfaced, not silenced.
