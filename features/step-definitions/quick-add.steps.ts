import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../../fixtures';
import { registerNamedAccount } from './support/demo-account';
import {
  createProject,
  deleteLabel,
  deleteProject,
  labelsNamed,
  latestTask,
  projectsNamed,
  scenarioProject,
  shareProject,
  userExists,
} from './support/demo-tasks';

const { Given, When, Then } = createBdd(test);

/**
 * Quick Add Magic (requirements/QUICKADD.md). The action is typed in the browser; what was
 * saved is checked over the API, because the requirement is about the stored task (its
 * title, labels, project, priority, due date and repeat), not about how the list renders it.
 */

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TODAY = 'clock.today';

/** The day the browser believes it is (set by the Background), at 00:00 UTC. */
function today(scenario: Map<string, unknown>): Date {
  const value = scenario.get(TODAY);
  if (!value) throw new Error('no fixed clock — the Background step "today is …" should run first');
  return value as Date;
}

const addDays = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** The next date after `from` that falls on `weekday` (1–7 days later). */
const nextWeekday = (from: Date, weekday: number) => addDays(from, ((weekday - from.getUTCDay() + 6) % 7) + 1);

type Api = Parameters<typeof latestTask>[0];
type Task = NonNullable<Awaited<ReturnType<typeof latestTask>>>;

/**
 * Quick Add saves in several requests: the task first, then its labels and assignees in
 * follow-ups, and the field clears after the first. Reading the server once, straight after,
 * raced those follow-ups (measured: an empty task list, and a label count that differed
 * between runs). So each check polls the stored task until it matches, within the normal
 * assertion timeout: a condition, not a sleep.
 */
const field =
  <T>(api: Api, read: (t: Task) => T) =>
  async (): Promise<T | undefined> => {
    const task = await latestTask(api);
    return task ? read(task) : undefined;
  };

/** For checks that something is ABSENT: wait for the task to exist first, or they pass vacuously. */
async function settled(api: Api): Promise<Task> {
  await expect
    .poll(
      field(api, (t) => t.id),
      { message: 'the new task was not saved' },
    )
    .toBeDefined();
  const task = await latestTask(api);
  if (!task) throw new Error('the new task disappeared');
  return task;
}

const isUnset = (due: string | null) => due === null || due.startsWith('0001-');
const labelTitles = (t: Task) => (t.labels ?? []).map((l) => l.title);

async function expectDue(api: Api, date: Date, time?: string) {
  await expect
    .poll(
      field(api, (t) => (isUnset(t.due_date) ? 'no due date' : t.due_date?.slice(0, 10))),
      { message: 'due date' },
    )
    .toBe(ymd(date));
  if (time)
    await expect
      .poll(
        field(api, (t) => t.due_date?.slice(11, 16)),
        { message: 'due time' },
      )
      .toBe(time);
}

Given(
  'today is {word} {int} {word} {int}',
  async ({ page, scenario }, weekday: string, day: number, month: string, year: number) => {
    const m = MONTHS.indexOf(month.toLowerCase());
    if (m === -1) throw new Error(`not a month: "${month}"`);
    const date = new Date(Date.UTC(year, m, day));
    // The sentence a reader trusts is the weekday, so a date that is not that weekday is a
    // typo in the scenario, and it fails here rather than as a confusing date mismatch later.
    expect(WEEKDAYS[date.getUTCDay()], `${day} ${month} ${year} is not a ${weekday}`).toBe(weekday.toLowerCase());
    await page.clock.setFixedTime(new Date(Date.UTC(year, m, day, 10, 0, 0)));
    scenario.set(TODAY, date);
  },
);

Given('no label named {string} exists', async ({ api }, title: string) => {
  for (const label of await labelsNamed(api, title)) await deleteLabel(api, label.id);
  expect(await labelsNamed(api, title)).toHaveLength(0);
});

Given('a project named {string} exists', async ({ api, cleanup }, title: string) => {
  if ((await projectsNamed(api, title)).length) return;
  const created = await createProject(api, title);
  cleanup.register(`project ${created.id}`, () => deleteProject(api, created.id));
});

Given('a user {string} exists', async ({ api, scenario }, username: string) => {
  // The setup project provisions the accounts scenarios name, because registering here,
  // mid-run, spends the application's per-IP rate limit (measured: HTTP 429). Registering
  // is the fallback for an environment where setup did not.
  if (!(await userExists(api, username))) await registerNamedAccount(api, username);
  expect(await userExists(api, username), `account "${username}"`).toBe(true);
  // Quick Add only assigns someone who can see the project (probed on v2.5.0: without access,
  // the "@name" text stays in the title and nobody is assigned).
  await shareProject(api, scenarioProject(scenario).id, username);
});

When('I quick-add the task {string}', async ({ projectPage, scenario }, text: string) => {
  await projectPage.open(scenarioProject(scenario).id);
  await projectPage.quickAdd(text);
});

Then('the new task should be titled {string}', async ({ api }, title: string) => {
  await expect
    .poll(
      field(api, (t) => t.title),
      { message: 'title' },
    )
    .toBe(title);
});

Then('the new task should have the label {string}', async ({ api }, label: string) => {
  await expect.poll(field(api, labelTitles), { message: 'labels' }).toContain(label);
});

Then('the new task should have the labels {string} and {string}', async ({ api }, a: string, b: string) => {
  await expect
    .poll(
      field(api, (t) => labelTitles(t).sort()),
      { message: 'labels' },
    )
    .toEqual([a, b].sort());
});

Then('the new task should have exactly one label, {string}', async ({ api }, label: string) => {
  await expect.poll(field(api, labelTitles), { message: 'labels' }).toEqual([label]);
});

Then('a label named {string} should exist', async ({ api }, title: string) => {
  expect(await labelsNamed(api, title)).not.toHaveLength(0);
});

Then('the new task should be in the project {string}', async ({ api }, title: string) => {
  const [target] = await projectsNamed(api, title);
  expect(target, `no project named "${title}"`).toBeDefined();
  await expect
    .poll(
      field(api, (t) => t.project_id),
      { message: 'project' },
    )
    .toBe(target.id);
});

Then('the new task should have priority {int}', async ({ api }, priority: number) => {
  await expect
    .poll(
      field(api, (t) => t.priority),
      { message: 'priority' },
    )
    .toBe(priority);
});

Then('the new task should be due tomorrow', async ({ api, scenario }) => {
  await expectDue(api, addDays(today(scenario), 1));
});

Then('the new task should be due in {int} days', async ({ api, scenario }, days: number) => {
  await expectDue(api, addDays(today(scenario), days));
});

Then('the new task should be due next Monday', async ({ api, scenario }) => {
  await expectDue(api, nextWeekday(today(scenario), 1));
});

Then('the new task should be due on the next Tuesday', async ({ api, scenario }) => {
  await expectDue(api, nextWeekday(today(scenario), 2));
});

Then('the new task should be due on {string}', async ({ api, scenario }, written: string) => {
  // "17 February 2025", or "17 February" for the current year.
  const [day, month, year] = written.split(/\s+/);
  const m = MONTHS.indexOf((month ?? '').toLowerCase());
  if (m === -1) throw new Error(`not a date: "${written}"`);
  await expectDue(api, new Date(Date.UTC(year ? Number(year) : today(scenario).getUTCFullYear(), m, Number(day))));
});

Then('the new task should be due on day {int} of the current month', async ({ api, scenario }, day: number) => {
  const t = today(scenario);
  await expectDue(api, new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), day)));
});

Then('the new task should be due tomorrow at {string}', async ({ api, scenario }, time: string) => {
  await expectDue(api, addDays(today(scenario), 1), time);
});

Then('the new task should be due next Monday at {string}', async ({ api, scenario }, time: string) => {
  await expectDue(api, nextWeekday(today(scenario), 1), time);
});

// How Vikunja stores an interval: seconds in repeat_after, except monthly, which is a mode
// of its own (repeat_mode 1). Probed on v2.5.0.
const DAY = 86_400;
const REPEAT: Record<string, { repeat_after: number; repeat_mode: number }> = {
  day: { repeat_after: DAY, repeat_mode: 0 },
  '3 days': { repeat_after: 3 * DAY, repeat_mode: 0 },
  week: { repeat_after: 7 * DAY, repeat_mode: 0 },
  '2 weeks': { repeat_after: 14 * DAY, repeat_mode: 0 },
  month: { repeat_after: 0, repeat_mode: 1 },
};

Then('the new task should repeat every {string}', async ({ api }, interval: string) => {
  const expected = REPEAT[interval];
  if (!expected) throw new Error(`no expected repeat defined for "every ${interval}"`);
  await expect
    .poll(
      field(api, (t) => ({ repeat_after: t.repeat_after, repeat_mode: t.repeat_mode })),
      { message: 'repeat' },
    )
    .toEqual(expected);
});

Then('the new task should be assigned to {string}', async ({ api }, username: string) => {
  await expect
    .poll(
      field(api, (t) => (t.assignees ?? []).map((a) => a.username)),
      { message: 'assignees' },
    )
    .toContain(username);
});

Then('the new task should have no due date', async ({ api }) => {
  // Absence: wait until the task is saved (the due date travels in the first request).
  const { due_date: due } = await settled(api);
  expect(isUnset(due), `due date is ${due}`).toBe(true);
});
