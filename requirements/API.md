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

## REQ-API-007 — The project resource matches its published contract

**Priority:** normal

Creating and fetching a project both return an object carrying `id`, `title`,
`description`, `is_archived`, `is_favorite`, `parent_project_id` and an `owner`
with `id` and `username`, each of the declared type.

- Covered by: `tests/api/contract.api.spec.ts` → _the project resource matches its contract_

## REQ-API-008 — The task resource matches its published contract

**Priority:** normal

Creating, updating and listing tasks all return the declared shape, and the shape
survives a state change rather than only holding at creation.

- Covered by: `tests/api/contract.api.spec.ts` → _the task resource matches its contract, before and after completion_

## REQ-API-009 — The label resource matches its published contract

**Priority:** normal

Creating a label returns `id`, `title` and the `hex_color` that was requested.

- Covered by: `tests/api/contract.api.spec.ts` → _the label resource matches its contract_

## REQ-API-010 — The public service descriptor matches its published contract

**Priority:** normal

The unauthenticated `/info` endpoint returns `version`, `link_sharing_enabled` and
`max_file_size`. A client reads this before it has a session, so a change here
breaks users who cannot yet sign in.

- Covered by: `tests/api/contract.api.spec.ts` → _the public service descriptor matches its contract_

---

## Known provider inconsistency

`POST /api/v1/tasks/{id}` returns `identifier: ""`, while create, fetch and list all
return `"#1"` for the same task. `index` is correct throughout, so only the rendered
form is lost. Found by the contract checks on their first live run against v2.5.0.

It is a defect in the application under test, not in this suite, so it is pinned by a
characterisation test rather than hidden by loosening every schema. If it is ever
fixed, that test fails and tells us to tighten the shared `Task` schema.
