@app @quick-add-magic @journey:manage-work-in-a-project
Feature: Quick Add Magic
  As a person adding a task
  I want to set its details by typing markers into the title
  So that the task is labelled, filed, prioritised and scheduled in one step

  # Source: requirements/QUICKADD.md (reviewed 2026-11-03). This iteration covers the
  # critical and high requirements only (001, 003, 004, 005, 006, 007, 010, 012).
  # REQ-QUICKADD-002, 008, 009 and 011 (normal / low) are deliberately left without
  # scenarios so they stay in the coverage matrix as gaps.
  #
  # "The new task" is the one task the scenario adds; the Background project starts empty.
  # Titles containing double quotes are written in single quotes so the quotes reach the app.

  # Relative dates ("tomorrow", "next monday", "17th") depend on the day the suite runs. The
  # browser's clock is fixed, and its time zone is UTC (app.config.ts), so every scenario
  # means the same thing on every machine and every day of the week.
  Background:
    Given today is Wednesday 14 January 2026
    And a project created over the API

  # --- REQ-QUICKADD-001 — A label can be added by typing it into the title (high) ---

  @regression @req:REQ-QUICKADD-001
  Scenario: A label typed into the title is applied to the task
    When I quick-add the task "Order packing supplies *logistics"
    Then the new task should have the label "logistics"

  @regression @req:REQ-QUICKADD-001
  Scenario: The label marker is removed from the stored title
    When I quick-add the task "Order packing supplies *logistics"
    Then the new task should be titled "Order packing supplies"

  @regression @req:REQ-QUICKADD-001
  Scenario: A label that does not exist yet is created and applied
    Given no label named "logistics" exists
    When I quick-add the task "Order packing supplies *logistics"
    Then a label named "logistics" should exist
    And the new task should have the label "logistics"

  @regression @req:REQ-QUICKADD-001
  Scenario: A quoted label with spaces is applied as a single label
    When I quick-add the task 'Follow up *"waiting on others"'
    Then the new task should have exactly one label, "waiting on others"

  @regression @req:REQ-QUICKADD-001
  Scenario: Several labels typed into the title are all applied
    When I quick-add the task "Order packing supplies *urgent *logistics"
    Then the new task should have the labels "urgent" and "logistics"

  # --- REQ-QUICKADD-003 — A task can be placed in a project by typing its name (high) ---

  @regression @req:REQ-QUICKADD-003
  Scenario: A project named in the title receives the task
    Given a project named "Personal" exists
    When I quick-add the task "Renew passport +Personal"
    Then the new task should be in the project "Personal"

  @regression @req:REQ-QUICKADD-003
  Scenario: A quoted project name with spaces receives the task
    Given a project named "Office Move" exists
    When I quick-add the task 'Book movers +"Office Move"'
    Then the new task should be in the project "Office Move"

  # --- REQ-QUICKADD-004 — A priority can be set by typing it into the title (high) ---

  @regression @req:REQ-QUICKADD-004
  Scenario: The lowest priority is set from the title
    When I quick-add the task "Tidy desk !1"
    Then the new task should have priority 1

  @regression @req:REQ-QUICKADD-004
  Scenario: The urgent priority is set from the title
    When I quick-add the task "Fix leak !5"
    Then the new task should have priority 5

  # --- REQ-QUICKADD-005 — A due date can be set by typing a date into the title (critical) ---

  @smoke @req:REQ-QUICKADD-005
  Scenario: "tomorrow" sets the due date to tomorrow
    When I quick-add the task "Call supplier tomorrow"
    Then the new task should be due tomorrow

  @smoke @req:REQ-QUICKADD-005
  Scenario: "in 5 days" sets the due date five days from today
    When I quick-add the task "Call supplier in 5 days"
    Then the new task should be due in 5 days

  @smoke @req:REQ-QUICKADD-005
  Scenario: "next monday" sets the due date to next Monday
    When I quick-add the task "Call supplier next monday"
    Then the new task should be due next Monday

  # Reviewed: with the clock fixed on a Wednesday, "the next Tuesday" is unambiguous. Still
  # undefined by the source, and untested: adding "tuesday" ON a Tuesday.
  # (was) TODO: the criterion says "the next occurrence of Tuesday" but not what that is when the
  # task is added on a Tuesday (today, or seven days out). Confirm before un-wipping.
  @smoke @req:REQ-QUICKADD-005
  Scenario: A weekday name sets the due date to its next occurrence
    When I quick-add the task "Call supplier tuesday"
    Then the new task should be due on the next Tuesday

  # Reviewed: 17 cannot be a month, so this date is unambiguous. Still undefined by the
  # source, and untested: a date such as 05/02/2025 that reads both ways.
  # (was) TODO: the source does not say whether 17/02/2025 is always day/month or depends on the
  # user's locale. Confirm before un-wipping.
  @smoke @req:REQ-QUICKADD-005
  Scenario: A numeric date sets that due date
    When I quick-add the task "Call supplier 17/02/2025"
    Then the new task should be due on "17 February 2025"

  # Reviewed: on 14 January, 17 February has not passed, so the current year is unambiguous.
  # Still undefined by the source, and untested: a month and day that have already passed.
  # (was) TODO: the source does not say which year "Feb 17" takes (always the current year, or the
  # next one once 17 February has passed). Confirm before un-wipping.
  @smoke @req:REQ-QUICKADD-005
  Scenario: A month and day set that due date
    When I quick-add the task "Call supplier Feb 17"
    Then the new task should be due on "17 February"

  # Reviewed: on 14 January the 17th has not passed. Still undefined by the source, and
  # untested: "17th" typed after the 17th.
  # (was) TODO: the source does not say what "17th" resolves to once the 17th of the current month
  # has passed (this month, or next month). Confirm before un-wipping.
  @smoke @req:REQ-QUICKADD-005
  Scenario: A day of the month sets that due date
    When I quick-add the task "Call supplier 17th"
    Then the new task should be due on day 17 of the current month

  # --- REQ-QUICKADD-006 — A due time can be added with "at" (critical) ---

  @smoke @req:REQ-QUICKADD-006
  Scenario: A 12-hour time after a date sets the due time
    When I quick-add the task "Order packing supplies tomorrow at 5pm"
    Then the new task should be due tomorrow at "17:00"

  @smoke @req:REQ-QUICKADD-006
  Scenario: A 24-hour time after a date sets the due time
    When I quick-add the task "Team sync next monday at 17:00"
    Then the new task should be due next Monday at "17:00"

  # --- REQ-QUICKADD-007 — A task can be made repeating by typing an interval (high) ---

  @regression @req:REQ-QUICKADD-007
  Scenario: "every day" makes the task repeat daily
    When I quick-add the task "Water plants every day"
    Then the new task should repeat every "day"

  @regression @req:REQ-QUICKADD-007
  Scenario: "every 3 days" makes the task repeat every three days
    When I quick-add the task "Water plants every 3 days"
    Then the new task should repeat every "3 days"

  @regression @req:REQ-QUICKADD-007
  Scenario: "every week" makes the task repeat weekly
    When I quick-add the task "Review budget every week"
    Then the new task should repeat every "week"

  @regression @req:REQ-QUICKADD-007
  Scenario: "every 2 weeks" makes the task repeat fortnightly
    When I quick-add the task "Review budget every 2 weeks"
    Then the new task should repeat every "2 weeks"

  @regression @req:REQ-QUICKADD-007
  Scenario: "every month" makes the task repeat monthly
    When I quick-add the task "Pay rent every month"
    Then the new task should repeat every "month"

  # --- REQ-QUICKADD-010 — Several markers can be combined in one title (critical) ---

  @smoke @req:REQ-QUICKADD-010
  Scenario: Label, priority, date and time combine and leave the plain title
    When I quick-add the task "Order packing supplies *logistics !3 tomorrow at 5pm"
    Then the new task should be titled "Order packing supplies"
    And the new task should have the label "logistics"
    And the new task should have priority 3
    And the new task should be due tomorrow at "17:00"

  @smoke @req:REQ-QUICKADD-010
  Scenario: Project, label, repetition, weekday and time combine and leave the plain title
    Given a project named "Office Move" exists
    When I quick-add the task 'Moving check-in +"Office Move" *urgent every week monday at 10am'
    Then the new task should be titled "Moving check-in"
    And the new task should be in the project "Office Move"
    And the new task should have the label "urgent"
    And the new task should repeat every "week"
    And the new task should be due next Monday at "10:00"

  @smoke @req:REQ-QUICKADD-010
  Scenario: Assignee, labels and a relative date combine
    Given a user "david" exists
    When I quick-add the task "Finalize seating chart *urgent *logistics @david in 5 days"
    Then the new task should be assigned to "david"
    And the new task should have the labels "urgent" and "logistics"
    And the new task should be due in 5 days

  # --- REQ-QUICKADD-012 — Quoting the whole title disables parsing (critical) ---

  @smoke @req:REQ-QUICKADD-012
  Scenario: A fully quoted title is stored literally
    When I quick-add the task '"Buy milk tomorrow"'
    Then the new task should be titled "Buy milk tomorrow"

  @smoke @req:REQ-QUICKADD-012
  Scenario: A fully quoted title does not set a due date
    When I quick-add the task '"Buy milk tomorrow"'
    Then the new task should have no due date
