@app @authentication
Feature: Authentication
  As a user of the application
  I want to sign in
  So that my work is protected

  Background:
    Given I am signed out

  @smoke
  Scenario: Sign in with valid credentials
    When I sign in with valid credentials
    Then I should be signed in

  Scenario: An incorrect password is rejected
    When I sign in with an incorrect password
    Then I should not be signed in
