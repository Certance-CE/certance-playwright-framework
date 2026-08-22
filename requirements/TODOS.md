---
epic: Todo list
journey: Manage todos
priority: normal
---

# Todo list

Requirements for the portability lane, exercised against the public TodoMVC demo
— a second application with no login, proving the framework is not welded to one
target.

## REQ-TODO-001 — A todo can be added

**Priority:** critical

Entering text and submitting adds the item to the list and increments the count.

- Covered by: `features/todos.feature` → _Add a todo_

## REQ-TODO-002 — A todo can be completed

**Priority:** critical

Marking an item complete changes its state without removing it from the list.

- Covered by: `features/todos.feature` → _Complete a todo_

## REQ-TODO-003 — The list can be filtered by state

**Priority:** normal

Filtering by Active shows only incomplete items; filtering by Completed shows
only complete ones.

- Covered by: `features/todos.feature` → _Filter active and completed todos_

## REQ-TODO-004 — Completed todos can be cleared

**Priority:** normal

Clearing completed removes every complete item and leaves incomplete ones intact.

- Covered by: `features/todos.feature` → _Clear completed todos_

## REQ-TODO-005 — An existing todo can be edited

**Priority:** normal

Double-clicking a todo makes its text editable; the new text replaces the old on
commit and is discarded on escape.

> Deliberately uncovered — TodoMVC supports editing and the framework does not
> test it. A matrix that reported 100% would be describing its own scenarios
> rather than the application.
