---
mode: agent
description: >
  Generate or update the onboarding runbook so a new engineer can clone the
  repo, complete auth setup, and execute a smoke test in under 30 minutes.
  Reads actual config files, package.json scripts, and CI setup to ensure accuracy.
---

# Prompt: Onboarding Runbook

You are acting as the Certance technical writer. Generate a complete onboarding
runbook targeting: **${input:audience:engineer | qa-lead}**

The runbook must enable a new team member to go from zero to running a
smoke test in under 30 minutes, following the document alone.

## Your steps

1. Read the following files to gather accurate information:
   - `package.json` — available npm scripts
   - `playwright.config.ts` — test configuration, projects, base URL
   - `README.md` — existing onboarding notes (do not duplicate, improve)
   - `.github/workflows/` — CI setup and secrets used
   - `skills/core/auth.md` if it exists — auth setup procedure
   - `.env.example` if it exists — required environment variables

2. Identify the exact sequence of steps a new engineer must take.
   Every step must be verifiable — include expected terminal output.

3. Write the runbook to `docs/07-runbooks/onboarding.md`:

````markdown
---
title: 'Runbook: New Engineer Onboarding'
section: 'arc42 §7 — Deployment View'
audience: <engineer | qa-lead>
status: stable
time-to-complete: ~30 minutes
prerequisites: |
  - Git and Node.js 20+ installed
  - Access to the repository
  - <any access credentials or VPN requirements — use [CLIENT] for client-specific items>
last-updated: <YYYY-MM-DD>
---

# Runbook: New Engineer Onboarding

> **Time:** ~30 minutes
> **Outcome:** You can clone, configure, authenticate, and execute the smoke suite.

---

## Step 1 — Clone and install

```bash
git clone <repo-url>
cd <repo-name>
npm install
```
````

Expected: `added NNN packages` with no errors.

---

## Step 2 — Configure environment

Copy the environment template and fill in required values:

```bash
cp .env.example .env
```

Required variables:

| Variable     | Purpose       | Where to get it   |
| ------------ | ------------- | ----------------- |
| `<VAR_NAME>` | <description> | <where to obtain> |
| ...          | ...           | ...               |

---

## Step 3 — Auth setup

<Exact steps for STORAGE_STATE_BASE64 or equivalent auth pattern.
Do not include real credentials — describe where to obtain them.>

---

## Step 4 — Run smoke suite

```bash
npm run test:smoke
```

Expected: all `@smoke` tests pass. Green output in the terminal.
Full results available at: `playwright-report/index.html`

---

## Step 5 — Verify Allure report (optional)

```bash
npx allure serve allure-results
```

Expected: browser opens with test results grouped by epic/feature.

---

## Troubleshooting

| Symptom                    | Likely cause                  | Fix                            |
| -------------------------- | ----------------------------- | ------------------------------ |
| `AUTH_ERROR` on startup    | Missing or expired auth state | Re-run auth setup (Step 3)     |
| `ENOENT .env`              | Environment file missing      | Re-run Step 2                  |
| Tests timeout on first run | Base URL unreachable          | Check VPN / environment config |

---

## Related

- [Auth setup](../05-ci-cd/auth-setup.md) — full auth pattern explanation
- [Golden rules](../08-contributing/golden-rules.md) — what you must follow
- [BDD workflow](../03-framework-structure/bdd-workflow.md) — if writing BDD tests

```

4. Self-audit:
   - Every command is verbatim-correct (taken from package.json scripts)?
   - Troubleshooting table covers the three most common failure modes?
   - No credentials, tokens, or client URLs present?
   - A junior engineer with no context could follow this end-to-end?

5. Report: "Onboarding runbook written to `docs/07-runbooks/onboarding.md`.
   Time-to-complete target: 30 minutes. Covers <N> steps."
```
