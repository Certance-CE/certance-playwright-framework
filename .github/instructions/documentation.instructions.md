---
applyTo: 'docs/**'
---

# Documentation — golden rules (non-negotiable)

These standards apply automatically when editing anything under `docs/`.
They are path-scoped (rather than repository-wide) so they do not consume
context on test-code tasks.

## Structure standard: arc42

All architecture and framework documentation follows the arc42 template:

- Section 1 → `docs/01-introduction/`
- Section 3 → `docs/02-architecture/`
- Section 5 → `docs/03-framework-structure/`
- Section 8 → `docs/06-decision-log/` (Architecture Decision Records)

## Diagrams standard: C4 Model in Mermaid

- All architecture diagrams use C4 Model notation in Mermaid code blocks
- No static images, no PowerPoint exports, no PNG screenshots
- Mermaid renders natively in GitHub and in Confluence with the Mermaid plugin
- Four zoom levels: Context → Container → Component → Code

## Audience tagging

Every documentation page must declare its audience in YAML frontmatter:

```yaml
---
title: <page title>
audience: engineer | qa-lead | leadership
status: draft | review | stable
---
```

## Navigation and discoverability

- Every section must be reachable within two clicks from `docs/README.md`
- `docs/README.md` is the navigation hub — it contains a Mermaid site map and
  a table with links to every doc section
- Every document ends with a `## Related` section linking to 2–3 related pages
- No dead-end pages

## Prose rules

- Maximum 3 sentences before a heading or list breaks the text
- Tables over bullet lists for structured comparisons
- All code blocks carry a language tag (` ```typescript `, ` ```mermaid `, etc.)
- No document longer than 400 lines — split with anchor links

## Confidentiality

- Never include client names, project names, or internal system names from
  regulated engagements in documentation committed to a shared or public repository
- Use `[CLIENT]` as a placeholder for client-specific references
- Never include real credentials, tokens, environment URLs, or internal hostnames
- PII masking applies to all test data examples and runbook screenshots

## Living documentation

- Documentation changes must accompany code changes in the same PR
- `docs/06-decision-log/` must contain an ADR for every major framework decision
- ADR status must be kept current: Proposed → Accepted → Deprecated
