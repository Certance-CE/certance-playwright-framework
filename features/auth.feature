@toolshop @authentication
Feature: Authentication
  As a shopper
  I want to sign in and out
  So that my account and orders are protected

  Background:
    Given I have a newly registered account

  @smoke
  Scenario: Sign in with valid credentials
    When I sign in with my credentials
    Then I should be signed in

  Scenario: An incorrect password is rejected
    When I sign in with an incorrect password
    Then I should see an invalid credentials message
    And I should not be signed in

  Scenario: Signing out ends the session
    Given I am signed in
    When I sign out
    Then I should be signed out
