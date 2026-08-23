import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../../fixtures';
import { createProject, createTask, deleteProject, tasksInProject, type DemoProject } from './support/demo-tasks';

const { Given, When, Then } = createBdd(test);

/** The project this scenario owns, kept in the generic per-scenario scratch space. */
const PROJECT = 'demo.project';

function project(scenario: Map<string, unknown>): DemoProject {
  const value = scenario.get(PROJECT);
  if (!value) throw new Error('no project for this scenario — the Background step should run first');
  return value as DemoProject;
}

Given('a project created over the API', async ({ api, data, scenario, cleanup }) => {
  const created = await createProject(api, data.projectName('Ledger'));
  scenario.set(PROJECT, created);
  // Registered immediately, so a failure later in the scenario still cleans up.
  cleanup.register(`project ${created.id}`, () => deleteProject(api, created.id));
});

Given('the project already has the task {string}', async ({ api, scenario }, title: string) => {
  await createTask(api, project(scenario).id, title);
});

When('I open the project', async ({ projectPage, scenario }) => {
  await projectPage.open(project(scenario).id);
});

When('I reload the project', async ({ projectPage, scenario }) => {
  // A full reload, not a client-side refresh: completed tasks leave the open list only
  // once the view is re-fetched, and asserting before that would pass on a stale DOM.
  await projectPage.open(project(scenario).id);
});

When('I add the task {string}', async ({ projectPage, scenario }, title: string) => {
  await projectPage.open(project(scenario).id);
  await projectPage.addTask(title);
});

When('I complete the task {string}', async ({ projectPage }, title: string) => {
  await projectPage.completeTask(title);
});

Then('the task {string} should be listed', async ({ projectPage }, title: string) => {
  await projectPage.expectTaskListed(title);
});

Then('the task {string} should not be listed', async ({ projectPage }, title: string) => {
  await projectPage.expectTaskNotListed(title);
});

/**
 * The UI and the server are asserted separately on purpose.
 *
 * "It disappeared from the list" is a claim about rendering. Whether the task was
 * completed, hidden by a filter, or deleted outright are three different outcomes that
 * look identical in the browser — and only one of them is correct. Checking the source
 * is what turns the UI assertion into evidence.
 */
Then('the API should report {string} as done', async ({ api, scenario }, title: string) => {
  const tasks = await tasksInProject(api, project(scenario).id);
  expect(tasks.find((t) => t.title === title)?.done, `${title} should be done on the server`).toBe(true);
});

Then('the API should report {int} task(s) in the project', async ({ api, scenario }, count: number) => {
  const tasks = await tasksInProject(api, project(scenario).id);
  expect(tasks).toHaveLength(count);
});

Given('the task {string} is due in {int} days', async ({ api, scenario }, title: string, days: number) => {
  // Set over the API: a date picker is not what this scenario is about, and driving
  // one would make the test fail for reasons unrelated to the requirement.
  const tasks = await tasksInProject(api, project(scenario).id);
  const task = tasks.find((t) => t.title === title);
  expect(task, `no task titled "${title}" in the project`).toBeDefined();
  const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const response = await api.post(`/api/v1/tasks/${task!.id}`, { data: { due_date: due } });
  expect(response.status()).toBe(200);
});

When('I open the upcoming view', async ({ upcomingPage }) => {
  await upcomingPage.open();
});

Then('the task {string} should be listed as upcoming', async ({ upcomingPage }, title: string) => {
  await upcomingPage.expectTaskListed(title);
});
