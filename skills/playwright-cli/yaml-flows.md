# YAML Flow Recording

> Status: Planned — documents advanced playwright-cli YAML workflow capture.

Load this guide when: recording multi-step user flows as YAML for review by
non-technical stakeholders or for Generator agent input.

---

## Overview

`playwright-cli` can export recorded sessions as structured YAML flows.
These YAML files serve as an intermediate format between manual exploration
and full Playwright spec generation.

```yaml
# Example recorded flow: task-creation.yaml
flow: Create a task
steps:
  - action: navigate
    url: https://staging.your-app.com
  - action: click
    role: button
    name: Create task
  - action: fill
    role: textbox
    name: Task name
    value: 'My new task'
  - action: click
    role: button
    name: Save
  - action: assert
    role: link
    name: 'My new task'
    visible: true
```

---

## Generating a YAML flow

```bash
playwright-cli record --format yaml --output flows/task-creation.yaml \
  https://staging.your-app.com
```

---

## Using YAML flows with the Generator agent

Pass the YAML flow file to the Generator agent as additional context:

```
"Read flows/task-creation.yaml and generate a BDD feature and step definitions."
```

The Generator will translate the YAML steps into Gherkin scenarios and
TypeScript step definitions using the correct locator strategy.
