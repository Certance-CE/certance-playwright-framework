@app @task-management
Feature: Task management
  As someone tracking work
  I want to add and complete tasks in a project
  So that the list shows what still needs doing

  # Each scenario gets a project of its own, created over the API rather than driven
  # through the browser: seeding is not the thing under test, and doing it over HTTP
  # keeps the UI assertions about one behaviour each.

  Background:
    Given a project created over the API

  @smoke @req:REQ-TASK-001
  Scenario: Add a task through the interface
    When I add the task "Reconcile settlement file"
    Then the task "Reconcile settlement file" should be listed
    And the API should report 1 task in the project

  @regression @req:REQ-TASK-002
  Scenario: A task created over the API appears in the interface
    Given the project already has the task "Seeded remotely"
    When I open the project
    Then the task "Seeded remotely" should be listed

  @smoke @req:REQ-TASK-003
  Scenario: Complete a task
    Given the project already has the task "Archive Q3 statements"
    When I open the project
    And I complete the task "Archive Q3 statements"
    Then the API should report "Archive Q3 statements" as done

  @regression @req:REQ-TASK-004
  Scenario: A completed task leaves the open list but is not deleted
    Given the project already has the task "Old invoice"
    And the project already has the task "Still outstanding"
    When I open the project
    And I complete the task "Old invoice"
    And I reload the project
    Then the task "Old invoice" should not be listed
    And the task "Still outstanding" should be listed
    And the API should report 2 tasks in the project
