# Playwright CLI Reference

Load this guide when: using `playwright-cli` for bulk test generation,
recording interactions, or scaffolding tests against a live application.

---

## Installation

```bash
npm install -g @playwright/cli@latest
```

---

## Core commands

```bash
# Open a URL and start an interactive session
playwright-cli open https://staging.your-app.com --headed

# Take a DOM snapshot (accessibility tree) — used by Generator agent
playwright-cli snapshot

# Click an element by its element ID from the snapshot
playwright-cli click e21

# Fill a form field
playwright-cli fill e45 "my value"

# Take a screenshot
playwright-cli screenshot

# Generate a Playwright test from recorded actions
playwright-cli codegen https://staging.your-app.com
```

---

## Agent mode — bulk test generation

The Playwright CLI is the preferred transport for the Generator agent:

```bash
# Pin the CLI to the same version as @playwright/test
npx @playwright/cli@$(node -p "require('./node_modules/@playwright/test/package.json').version") \
  open https://staging.your-app.com
```

CLI outputs each action to stdout — the agent reads only the relevant parts,
keeping token consumption to ~27,000 tokens per session vs. ~114,000 for MCP.

---

## CodeGen — interactive recording

```bash
# Record actions and generate a spec file
npx playwright codegen --output tests/recorded.spec.ts https://staging.your-app.com
```

> **Important:** Always review generated code. CodeGen may generate CSS
> selectors — replace them with `getByRole()` or `getByLabel()` per the
> locator strategy guide before committing.
