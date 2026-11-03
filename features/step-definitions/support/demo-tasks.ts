import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Task and project provisioning over the demo application's API (client layer —
 * golden rule #12 keeps application knowledge out of the framework core).
 *
 * Seeding state over HTTP rather than driving it through the browser is the point of
 * the `api` fixture: it is faster, it cannot flake on a locator, and it leaves the UI
 * test asserting only the thing it is actually about.
 */
export interface DemoProject {
  id: number;
  title: string;
}

/** The project this scenario owns, kept in the generic per-scenario scratch space. */
export const PROJECT = 'demo.project';

export function scenarioProject(scenario: Map<string, unknown>): DemoProject {
  const value = scenario.get(PROJECT);
  if (!value) throw new Error('no project for this scenario — the Background step should run first');
  return value as DemoProject;
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>, status: number): Promise<T> {
  // Insist on the shape, not just the status: a single-page application answers 200
  // with HTML for a route it does not know, and the failure surfaces much later.
  expect(response.status(), `${response.url()} — ${(await response.text()).slice(0, 120)}`).toBe(status);
  const body = await response.json();
  expect(body, `${response.url()} returned ${status} but no id`).toHaveProperty('id');
  return body as T;
}

export async function createProject(api: APIRequestContext, title: string): Promise<DemoProject> {
  return json<DemoProject>(await api.put('/api/v1/projects', { data: { title } }), 201);
}

export async function deleteProject(api: APIRequestContext, id: number) {
  await api.delete(`/api/v1/projects/${id}`);
}

export async function createTask(api: APIRequestContext, projectId: number, title: string) {
  return json<{ id: number; title: string; done: boolean }>(
    await api.put(`/api/v1/projects/${projectId}/tasks`, { data: { title } }),
    201,
  );
}

/** Every task in a project, as the server sees it — used to verify what the UI claims. */
export async function tasksInProject(
  api: APIRequestContext,
  projectId: number,
): Promise<{ id: number; title: string; done: boolean }[]> {
  const response = await api.get(`/api/v1/projects/${projectId}/tasks`);
  expect(response.status()).toBe(200);
  return response.json();
}

/** A task as the server stores it, with the fields Quick Add Magic sets. */
export interface DemoTaskDetail {
  id: number;
  title: string;
  project_id: number;
  priority: number;
  due_date: string | null;
  repeat_after: number;
  repeat_mode: number;
  labels: { id: number; title: string }[] | null;
  assignees: { username: string }[] | null;
}

/**
 * The most recently created task of the signed-in user, in full, or undefined if there is
 * none yet. Quick Add may move a task into another project, so "the task just added" is
 * found by id, not by project. It does not throw, so it can be polled (see quick-add.steps).
 */
export async function latestTask(api: APIRequestContext): Promise<DemoTaskDetail | undefined> {
  const list = await api.get('/api/v1/tasks', { params: { sort_by: 'id', order_by: 'desc', per_page: 1 } });
  expect(list.status()).toBe(200);
  const [latest] = ((await list.json()) ?? []) as { id: number }[];
  if (!latest) return undefined;
  const response = await api.get(`/api/v1/tasks/${latest.id}`);
  expect(response.status()).toBe(200);
  return response.json();
}

export async function labelsNamed(api: APIRequestContext, title: string): Promise<{ id: number; title: string }[]> {
  const response = await api.get('/api/v1/labels', { params: { s: title } });
  expect(response.status()).toBe(200);
  const labels = ((await response.json()) ?? []) as { id: number; title: string }[];
  return labels.filter((l) => l.title === title);
}

export async function deleteLabel(api: APIRequestContext, id: number) {
  expect((await api.delete(`/api/v1/labels/${id}`)).status()).toBe(200);
}

export async function projectsNamed(api: APIRequestContext, title: string): Promise<DemoProject[]> {
  const response = await api.get('/api/v1/projects', { params: { s: title } });
  expect(response.status()).toBe(200);
  return ((await response.json()) as DemoProject[]).filter((p) => p.title === title);
}

/** Whether an account with exactly this username exists. */
export async function userExists(api: APIRequestContext, username: string): Promise<boolean> {
  const response = await api.get('/api/v1/users', { params: { s: username } });
  expect(response.status()).toBe(200);
  return (((await response.json()) ?? []) as { username: string }[]).some((u) => u.username === username);
}

/** Give another user write access to a project, so they can be assigned its tasks. */
export async function shareProject(api: APIRequestContext, projectId: number, username: string) {
  const response = await api.put(`/api/v1/projects/${projectId}/users`, { data: { username, permission: 1 } });
  expect([200, 201], `sharing project ${projectId} with ${username}`).toContain(response.status());
}
