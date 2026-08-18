@todos
Feature: Todo list
  As someone tracking work
  I want to add, complete, filter and clear todos
  So that my list reflects what still needs doing

  Background:
    Given I open the todo app

  @smoke
  Scenario: Add a todo
    When I add the todo "Buy milk"
    Then the todo "Buy milk" should be visible
    And there should be 1 todo

  @smoke
  Scenario: Complete a todo
    Given I have added the todo "Write tests"
    When I complete the todo "Write tests"
    Then the todo "Write tests" should be completed

  @regression
  Scenario: Filter active and completed todos
    Given I have added the todo "Active task"
    And I have added the todo "Done task"
    And I complete the todo "Done task"
    When I filter by "Active"
    Then the todo "Active task" should be visible
    And the todo "Done task" should not be visible
    When I filter by "Completed"
    Then the todo "Done task" should be visible
    And the todo "Active task" should not be visible

  @regression
  Scenario: Clear completed todos
    Given I have added the todo "Keep me"
    And I have added the todo "Remove me"
    And I complete the todo "Remove me"
    When I clear completed todos
    Then the todo "Remove me" should not be visible
    And the todo "Keep me" should be visible
