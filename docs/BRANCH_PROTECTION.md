# Branch protection

Server-enforced branch protection (rulesets / required checks) requires GitHub
Pro, Team, or Enterprise on a **private** repository. On the free plan this repo
uses a **client-side guardrail** instead, plus a PR-only workflow.

## Client-side guardrail (active by default)

`.githooks/pre-push` refuses to:

- push **directly** to `main` / `master`,
- **force-push** a protected branch,
- **delete** a protected branch.

It is activated by pointing git at the versioned hooks directory:

```bash
git config core.hooksPath .githooks
```

`npm install` does this automatically via the `prepare` script; you can also run
`npm run setup:hooks`. The hook is version-controlled, so every clone gets it.

**Workflow:** branch → push → open a PR → merge on GitHub.

**Emergency bypass** (use sparingly, e.g. a genuine hotfix): `git push --no-verify`.

> The guardrail is local, so it protects _your_ machine, not the server. It stops
> accidents; it is not a substitute for server-side enforcement against a
> determined push or another contributor.

## Upgrading to server-side enforcement

If you move to GitHub Pro/Team (or make the repo public), enable a ruleset on
`main`: block force-push + deletion, require a PR, and require the
`BDD smoke — Chromium` status check. The exact config is ready to apply via the
GitHub API — ask the framework maintainer.
