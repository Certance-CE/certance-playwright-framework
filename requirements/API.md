---
epic: Task management
journey: Manage work over the API
priority: normal
---

# Task management (API)

Requirements exercised **without a browser**, against the reference application's
REST API. The suite runs signed in as the account the `setup` project provisioned,
so an API test and a UI test act as the same user.

## REQ-API-001 — A project can be created and read back

**Priority:** critical

Creating a project returns 201 and the created resource; fetching it by id returns
the same title.

- Covered by: `tests/api/tasks.api.spec.ts` → _creates a project_

## REQ-API-002 — A task can be created inside a project

**Priority:** critical

Creating a task returns 201, belongs to the project it was created under, and
starts in the open state.

- Covered by: `tests/api/tasks.api.spec.ts` → _creates a task in a project_

## REQ-API-003 — A label can be attached to a task

**Priority:** normal

A label created on the account can be attached to a task, and the task then
reports that label when read back.

- Covered by: `tests/api/tasks.api.spec.ts` → _attaches a label to a task_

## REQ-API-004 — Tasks can be filtered by completion state

**Priority:** normal

Filtering by `done = false` returns the open tasks and **excludes** the completed
ones. Asserted both ways: a filter that returns everything would satisfy a test
that only checked the open task was present.

- Covered by: `tests/api/tasks.api.spec.ts` → _filters tasks by completion state_

## REQ-API-005 — An unauthenticated request is rejected

**Priority:** critical

A request carrying no session receives 401 rather than data.

- Covered by: `tests/api/tasks.api.spec.ts` → _rejects an unauthenticated request_

## REQ-API-006 — A project cannot be read by another account

**Priority:** high

A signed-in user requesting a project belonging to a different account receives
403 or 404 — never its contents.

> Deliberately uncovered. Rejecting *no* session (REQ-API-005) is a much weaker
> claim than rejecting the *wrong* session, and authorization is the property that
> matters to a regulated buyer. Covering it needs a second provisioned account,
> which the setup project does not yet create.
