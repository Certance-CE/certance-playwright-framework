import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I open the todo app', async ({ todoPage }) => {
  await todoPage.open();
});

Given('I have added the todo {string}', async ({ todoPage }, text: string) => {
  await todoPage.addTodo(text);
});

When('I add the todo {string}', async ({ todoPage }, text: string) => {
  await todoPage.addTodo(text);
});

When('I complete the todo {string}', async ({ todoPage }, text: string) => {
  await todoPage.toggle(text);
});

When('I filter by {string}', async ({ todoPage }, name: string) => {
  await todoPage.filterBy(name as 'All' | 'Active' | 'Completed');
});

When('I clear completed todos', async ({ todoPage }) => {
  await todoPage.clearCompleted();
});

Then('the todo {string} should be visible', async ({ todoPage }, text: string) => {
  await todoPage.expectVisible(text);
});

Then('the todo {string} should not be visible', async ({ todoPage }, text: string) => {
  await todoPage.expectNotVisible(text);
});

Then('the todo {string} should be completed', async ({ todoPage }, text: string) => {
  await todoPage.expectCompleted(text);
});

Then('there should be {int} todo(s)', async ({ todoPage }, count: number) => {
  await todoPage.expectCount(count);
});
