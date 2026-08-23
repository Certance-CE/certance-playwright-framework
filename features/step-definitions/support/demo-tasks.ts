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
): Promise<{ title: string; done: boolean }[]> {
  const response = await api.get(`/api/v1/projects/${projectId}/tasks`);
  expect(response.status()).toBe(200);
  return response.json();
}
