---
epic: Task management
journey: Manage work in a project
# TODO: confirm feature/journey (no existing journey covers quick-add parsing; "Manage work in a project" is the closest)
priority: normal
feature: quick-add-magic
---

# Quick Add Magic

> **Reviewed 2026-11-03** (provisional, for the reference demo): priorities set by business
> impact when the behaviour breaks. **Critical**: the task is saved with a wrong title or a
> wrong or missing due date, silently (005, 006, 010, 012). **High**: the task is saved but
> filed or flagged wrong (001, 003, 004, 007). **Normal / low**: a convenience the user can
> do by hand (002, 008, 009, 011). Critical and high are automated in this iteration; the
> rest stay in the matrix as gaps.

Requirements for setting task details (labels, assignees, project, priority, due
date, repetition, subtasks) by typing them into the task title when a task is
created in the web UI.

Source: https://vikunja.io/help/quick-add-magic (fetched 2026-10-29). Every
requirement below traces to that page. The source never says any of this
behaviour is essential, so every requirement carries the default priority and a
`TODO` for the reviewer to set it.

## REQ-QUICKADD-001 — A label can be added by typing it into the title

**Priority:** high <!-- critical scenario: if this breaks, the task is saved but filed or flagged wrong -->

As a person adding a task, I want to type `*label` in the title so the task is
labelled without editing it afterwards.

- Given a project, When I add a task titled `Order packing supplies *logistics`, Then the task has the label "logistics"
- Given a project, When I add a task titled `Order packing supplies *logistics`, Then the task title is "Order packing supplies"
- Given no label named "logistics" exists, When I add a task titled `Order packing supplies *logistics`, Then a label "logistics" is created and applied to the task
- Given a project, When I add a task titled `Follow up *"waiting on others"`, Then the task has the single label "waiting on others"
- Given a project, When I add a task titled `Order packing supplies *urgent *logistics`, Then the task has both labels "urgent" and "logistics"

## REQ-QUICKADD-002 — A task can be assigned by typing a username into the title

**Priority:** normal <!-- convenience: if this breaks, the user can still do it by hand -->

As a person adding a task, I want to type `@username` in the title so the task is
assigned to that person when it is created.

- Given a user "sarah" exists, When I add a task titled `Book movers @sarah`, Then the task is assigned to sarah
- Given users "sarah" and "david" exist, When I add a task titled `Book movers @sarah @david`, Then the task is assigned to both sarah and david

> **TODO:** the source does not say what happens when `@username` names a user who does not exist or has no access to the project.

## REQ-QUICKADD-003 — A task can be placed in a project by typing its name into the title

**Priority:** high <!-- critical scenario: if this breaks, the task is saved but filed or flagged wrong -->

As a person adding a task, I want to type `+Project` in the title so the task lands
in that project instead of the current one.

- Given a project "Personal" exists, When I add a task titled `Renew passport +Personal`, Then the task is in the "Personal" project
- Given a project "Office Move" exists, When I add a task titled `Book movers +"Office Move"`, Then the task is in the "Office Move" project

> **TODO:** the source says the project "must already exist" but not what happens when it does not (error, ignored token, or task left in the current project).

## REQ-QUICKADD-004 — A priority can be set by typing it into the title

**Priority:** high <!-- critical scenario: if this breaks, the task is saved but filed or flagged wrong -->

As a person adding a task, I want to type `!N` in the title so the task gets a
priority from 1 (low) to 5 (urgent).

- Given a project, When I add a task titled `Tidy desk !1`, Then the task has priority 1 (low)
- Given a project, When I add a task titled `Fix leak !5`, Then the task has priority 5 (urgent)

> **TODO:** the source does not say what happens for a value outside 1–5 (e.g. `!0`, `!6`).

## REQ-QUICKADD-005 — A due date can be set by typing a date into the title

**Priority:** critical <!-- business-critical: if this breaks, the task is saved with a wrong title or a wrong or missing due date, silently -->

As a person adding a task, I want to type a natural-language date anywhere in the
title so it becomes the task's due date.

- Given a project, When I add a task titled `Call supplier tomorrow`, Then the task is due tomorrow
- Given a project, When I add a task titled `Call supplier in 5 days`, Then the task is due five days from today
- Given a project, When I add a task titled `Call supplier next monday`, Then the task is due next Monday
- Given a project, When I add a task titled `Call supplier tuesday`, Then the task is due on the next occurrence of Tuesday
- Given a project, When I add a task titled `Call supplier 17/02/2025`, Then the task is due on 17 February 2025
- Given a project, When I add a task titled `Call supplier Feb 17`, Then the task is due on 17 February
- Given a project, When I add a task titled `Call supplier 17th`, Then the task is due on the 17th of the current month

> **TODO:** the source lists further relative forms (today, tonight, this weekend, later this week, next week, next month, end of month) without saying which date or time each resolves to; confirm before writing criteria for them.
> **TODO:** the source does not say whether `17/02/2025` is always day/month or depends on locale, nor what `17th` does when the 17th of the current month has passed, nor which year `Feb 17` takes.
> **TODO:** the source does not say whether the date words are removed from the stored title (the intro example implies they are).

## REQ-QUICKADD-006 — A due time can be added with "at"

**Priority:** critical <!-- business-critical: if this breaks, the task is saved with a wrong title or a wrong or missing due date, silently -->

As a person adding a task, I want to add `at <time>` after a date so the task is
due at that time, not just on that day.

- Given a project, When I add a task titled `Order packing supplies tomorrow at 5pm`, Then the task is due tomorrow at 17:00
- Given a project, When I add a task titled `Team sync next monday at 17:00`, Then the task is due next Monday at 17:00

> **TODO:** the source does not say what time a date without `at` is given.

## REQ-QUICKADD-007 — A task can be made repeating by typing an interval into the title

**Priority:** high <!-- critical scenario: if this breaks, the task is saved but filed or flagged wrong -->

As a person adding a task, I want to type `every <interval>` in the title so the
task repeats.

- Given a project, When I add a task titled `Water plants every day`, Then the task repeats every day
- Given a project, When I add a task titled `Water plants every 3 days`, Then the task repeats every 3 days
- Given a project, When I add a task titled `Review budget every week`, Then the task repeats every week
- Given a project, When I add a task titled `Review budget every 2 weeks`, Then the task repeats every 2 weeks
- Given a project, When I add a task titled `Pay rent every month`, Then the task repeats every month

## REQ-QUICKADD-008 — Several tasks can be created at once, one per line

**Priority:** normal <!-- convenience: if this breaks, the user can still do it by hand -->

As a person adding tasks, I want to enter or paste several lines so that each line
becomes its own task in one go.

- Given a project, When I enter three task titles on separate lines (using Shift + Enter between them) and submit, Then three tasks are created, one per line
- Given a project, When I paste multiline text of three lines and submit, Then three tasks are created, one per line

## REQ-QUICKADD-009 — Indented lines become subtasks of the line above

**Priority:** normal <!-- convenience: if this breaks, the user can still do it by hand -->

As a person adding several tasks at once, I want to indent a line so it becomes a
subtask of the line above it.

- Given a project, When I submit `Plan moving day` followed by `Reserve loading dock` and `Notify all departments` each indented one level, Then both are subtasks of "Plan moving day"
- Given a project, When I submit `Notify all departments` followed by `Print department labels` indented one level deeper, Then "Print department labels" is a subtask of "Notify all departments"
- Given a project, When I submit an indented batch using tabs for indentation, Then the same parent/subtask structure is created as with spaces

> **TODO:** the source says indentation must be consistent within one batch but not what happens when it is mixed (spaces and tabs, or uneven widths).

## REQ-QUICKADD-010 — Several markers can be combined in one title

**Priority:** critical <!-- business-critical: if this breaks, the task is saved with a wrong title or a wrong or missing due date, silently -->

As a person adding a task, I want to combine markers in a single title so all the
details are set in one step and only the plain title remains.

- Given a project, When I add a task titled `Order packing supplies *logistics !3 tomorrow at 5pm`, Then the task is titled "Order packing supplies", labelled "logistics", priority 3, and due tomorrow at 17:00
- Given a project "Office Move" exists, When I add a task titled `Moving check-in +"Office Move" *urgent every week monday at 10am`, Then the task is titled "Moving check-in", is in "Office Move", is labelled "urgent", and repeats weekly due Monday at 10:00
- Given a user "david" exists, When I add a task titled `Finalize seating chart *urgent *logistics @david in 5 days`, Then the task is assigned to david, labelled "urgent" and "logistics", and due in 5 days

## REQ-QUICKADD-011 — The Todoist-compatible mode can be chosen in settings

**Priority:** low <!-- convenience, and the source does not define the behaviour -->

As a person used to Todoist, I want to switch Quick Add Magic to Todoist's
shortcuts so I can keep typing the markers I know.

- Given default settings, When I add a task using the markers above, Then the default mode's markers are interpreted
- Given I select "Todoist" under "Quick Add Magic Mode" in Settings, When I add a task, Then Todoist-style markers are interpreted instead

> **TODO:** the source does not list the Todoist-mode keywords, so the second criterion cannot be made concrete without another source.

## REQ-QUICKADD-012 — Quoting the whole title disables parsing

**Priority:** critical <!-- business-critical: if this breaks, the task is saved with a wrong title or a wrong or missing due date, silently -->

As a person adding a task whose title contains words Quick Add Magic would
interpret, I want to wrap the title in quotes so it is stored literally.

- Given a project, When I add a task titled `"Buy milk tomorrow"`, Then the task title is "Buy milk tomorrow"
- Given a project, When I add a task titled `"Buy milk tomorrow"`, Then the task has no due date

> **TODO:** the source does not say whether the surrounding quotes are kept in the stored title (the example implies they are stripped).
