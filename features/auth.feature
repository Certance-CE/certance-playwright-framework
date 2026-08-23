@app @authentication
Feature: Authentication
  As a user of the application
  I want to sign in
  So that my work is protected

  # @signed-out scenarios run in a project that injects no session, so there is
  # nothing to tear down. Everything else starts from the shared signed-in state.

  @smoke @signed-out @req:REQ-AUTH-001
  Scenario: Sign in with valid credentials
    Given I am signed out
    When I sign in with valid credentials
    Then I should be signed in

  @signed-out @req:REQ-AUTH-002
  Scenario: An incorrect password is rejected
    Given I am signed out
    When I sign in with an incorrect password
    Then I should not be signed in

  @smoke @req:REQ-AUTH-003
  Scenario: A signed-in session survives a page reload
    Given I am signed in
    When I reload the page
    Then I should be signed in
