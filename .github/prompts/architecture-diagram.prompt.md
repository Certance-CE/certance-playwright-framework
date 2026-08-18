---
mode: agent
description: >
  Generate a C4 Model architecture diagram in Mermaid syntax for a specified
  framework component or system. Reads actual source files to ensure accuracy.
  Output is a Mermaid code block ready to embed in a documentation page.
---

# Prompt: Architecture Diagram

You are acting as the Certance technical writer. Generate a **${input:diagram_type:C4 diagram type — Context | Container | Component | Sequence}** diagram
for: **${input:subject:What to diagram, e.g. "the agent pipeline" or "the auth fixture flow"}**

## Your steps

1. Read all source files relevant to the subject. Do not diagram from memory.
   - For agent pipeline: read `.github/agents/`, `skills/SKILL.md`
   - For Page Objects: list and read `pages/`
   - For auth flow: read `fixtures/`, `skills/core/auth.md`
   - For CI pipeline: read `.github/workflows/`

2. Choose the correct C4 diagram type:

| Choose            | When                                                      |
| ----------------- | --------------------------------------------------------- |
| `C4Context`       | Showing the system and its external actors / integrations |
| `C4Container`     | Showing major sub-systems or deployable units             |
| `C4Component`     | Showing internal components within one container          |
| `sequenceDiagram` | Showing a flow, process, or human-agent interaction       |

3. Generate the Mermaid diagram. Rules:
   - Every node has a label AND a description string
   - Relationships use active-voice labels (`"Authors tests using"`, `"Executes against"`)
   - No more than 12 nodes in a single diagram — split if larger
   - Always include a `title` line

4. Wrap output in a fenced code block:

   ` ```mermaid `
   < diagram code >
   ` ``` `

5. After the code block, write a short narrative (4–6 sentences) explaining what
   the diagram shows and why the architecture is structured this way. Connect to
   a quality or business outcome.

6. Suggest which documentation page this diagram belongs in based on the C4 level:
   - Context → `docs/02-architecture/overview.md`
   - Container/Component → `docs/02-architecture/component-map.md`
   - Sequence (agent pipeline) → `docs/02-architecture/agent-pipeline.md`
   - Sequence (runbook) → `docs/07-runbooks/<relevant-runbook>.md`

7. Flag any relationship or component you could not confirm from source files with:
   `[VERIFY: confirm this in <filename>]`
