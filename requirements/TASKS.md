---
epic: Task management
journey: Manage work in a project
priority: normal
---

# Task management (UI)

The showcase journey: a person working in the browser, against the self-hosted
reference application. State is seeded over the API — see `requirements/API.md` for
the same domain exercised without a browser.

Each scenario asserts in the interface **and** verifies at the source. "It vanished
from the list" is a claim about rendering; completed, filtered and deleted look
identical in a browser and only one of them is correct.

## REQ-TASK-001 — A task can be added through the interface

**Priority:** critical

Typing a title and submitting adds the task to the project's list, and the server
holds exactly one task afterwards.

- Covered by: `features/tasks.feature` → _Add a task through the interface_

## REQ-TASK-002 — A task created over the API appears in the interface

**Priority:** normal

State created outside the browser is visible inside it. This is what makes
seed-over-API a legitimate substitute for driving setup through the UI.

- Covered by: `features/tasks.feature` → _A task created over the API appears in the interface_

## REQ-TASK-003 — A task can be completed

**Priority:** critical

Marking a task complete records it as done on the server, not merely in the view.

The completion control is a screen-reader-only checkbox inside a styled label, so it
is activated from the keyboard — the path a keyboard or screen-reader user takes.
Clicking it with `force: true` would pass while proving nothing about whether a real
person can reach the control.

- Covered by: `features/tasks.feature` → _Complete a task_

## REQ-TASK-004 — A completed task leaves the open list without being deleted

**Priority:** normal

The List view shows outstanding work, so a completed task disappears from it on
reload while remaining in the project. Both halves matter: a view that hides the task
and a view that deletes it are indistinguishable on screen.

- Covered by: `features/tasks.feature` → _A completed task leaves the open list but is not deleted_

## REQ-TASK-005 — A task can be given a due date

**Priority:** normal

Setting a due date records it against the task and surfaces it in the Upcoming view.

- Covered by: `features/tasks.feature` → _A task with a due date appears in the upcoming view_

The date is set over the API rather than through a date picker: driving one would make
the scenario fail for reasons unrelated to the requirement. The assertion is in the UI,
where a due date becomes visible to a user rather than merely stored.
