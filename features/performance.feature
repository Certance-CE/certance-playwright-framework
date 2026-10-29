@app @task-management
Feature: Task workspace performance
  As someone who opens the task workspace many times a day
  I want it to load quickly and without the layout jumping
  So that the tool does not get in the way of the work

  # Measured against the self-hosted reference application, signed in, on the same
  # runner as the functional lanes. Budgets are Core Web Vitals "good" thresholds unless
  # the scenario sets its own.

  @perf @regression @req:REQ-PERF-001
  Scenario: The signed-in overview loads within the Core Web Vitals budget
    Given I am signed in
    Then the page meets its performance budget

  @perf @regression @req:REQ-PERF-002
  Scenario: A project's task list loads within the team's own, stricter budget
    Given a project created over the API
    And the project already has the task "Reconcile settlement file"
    When I open the project
    Then the task "Reconcile settlement file" should be listed
    And the page meets this performance budget:
      | lcp | 1500 |
      | cls | 0.05 |
