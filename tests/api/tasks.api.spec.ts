import { test, expect } from '../../fixtures';
import { request, type APIRequestContext } from '@playwright/test';

/**
 * The API lane — the framework exercised against the reference application's REST
 * API, with no browser involved.
 *
 * This is the counterpart to the BDD lanes, not a replacement for them. It exists
 * because two of this framework's claims can only be proven here:
 *
 *  - the `api` fixture is the documented way to seed state and verify it over HTTP
 *  - a suite should be able to assert an application's behaviour without a browser,
 *    in seconds rather than minutes
 *
 * Runs signed in as the account the setup project provisioned, so the session used
 * here and the session used by the UI lane belong to the same user.
 *
 * Every test creates its own project and registers a disposer, so no test can see
 * another's data and nothing survives the run.
 */

interface Project {
  id: number;
  title: string;
}

interface Task {
  id: number;
  title: string;
  done: boolean;
  project_id: number;
  labels: { id: number; title: string }[] | null;
}

/**
 * Read a JSON body, insisting it is JSON of the expected shape.
 *
 * `response.ok()` alone is not proof the API answered: a single-page application
 * serves its shell for any route it does not recognise, so a mistyped path returns
 * 200 with HTML and the assertion that follows fails somewhere far less obvious.
 */
async function expectJson<T>(
  response: Awaited<ReturnType<APIRequestContext['get']>>,
  status: number,
  key: keyof T & string,
): Promise<T> {
  expect(response.status(), `${response.url()} — ${(await response.text()).slice(0, 120)}`).toBe(status);
  const body = await response.json();
  expect(body, `${response.url()} returned ${status} but not a ${key}-bearing object`).toHaveProperty(key);
  return body as T;
}

/** Create a project and register its removal. Returns the created project. */
async function createProject(
  api: APIRequestContext,
  cleanup: { register: (l: string, d: () => unknown) => void },
  title: string,
) {
  const project = await expectJson<Project>(await api.put('/api/v1/projects', { data: { title } }), 201, 'id');
  cleanup.register(`project ${project.id}`, () => api.delete(`/api/v1/projects/${project.id}`));
  expect(project.title).toBe(title);
  return project;
}

/** Create a task inside a project. Deleted with its project, so no disposer of its own. */
async function createTask(api: APIRequestContext, projectId: number, title: string) {
  return expectJson<Task>(await api.put(`/api/v1/projects/${projectId}/tasks`, { data: { title } }), 201, 'id');
}

test.describe('API lane — projects, tasks and labels', () => {
  test(
    'creates a project',
    { tag: ['@app', '@task-management', '@smoke', '@req:REQ-API-001'] },
    async ({ api, data, cleanup }) => {
      const project = await createProject(api, cleanup, data.projectName('Ledger'));

      const listed = await expectJson<Project>(await api.get(`/api/v1/projects/${project.id}`), 200, 'id');
      expect(listed.title).toBe(project.title);
    },
  );

  test(
    'creates a task in a project',
    { tag: ['@app', '@task-management', '@smoke', '@req:REQ-API-002'] },
    async ({ api, data, cleanup }) => {
      const project = await createProject(api, cleanup, data.projectName('Settlement'));
      const title = data.taskName('Reconcile');

      const task = await createTask(api, project.id, title);

      expect(task.title).toBe(title);
      expect(task.project_id).toBe(project.id);
      // A new task is open. Asserted because the UI lane's "complete a task" scenario
      // is only meaningful if the starting state is known.
      expect(task.done).toBe(false);
    },
  );

  test(
    'attaches a label to a task',
    { tag: ['@app', '@task-management', '@regression', '@req:REQ-API-003'] },
    async ({ api, data, cleanup }) => {
      const project = await createProject(api, cleanup, data.projectName('Compliance'));
      const task = await createTask(api, project.id, data.taskName('File report'));

      const labelTitle = data.unique('regulatory');
      const label = await expectJson<{ id: number }>(
        await api.put('/api/v1/labels', { data: { title: labelTitle, hex_color: 'e8a33d' } }),
        201,
        'id',
      );
      // Labels are account-scoped, not project-scoped, so this one outlives the project.
      cleanup.register(`label ${label.id}`, () => api.delete(`/api/v1/labels/${label.id}`));

      expect((await api.put(`/api/v1/tasks/${task.id}/labels`, { data: { label_id: label.id } })).status()).toBe(201);

      const withLabel = await expectJson<Task>(await api.get(`/api/v1/tasks/${task.id}`), 200, 'id');
      expect(withLabel.labels?.map((l) => l.title)).toEqual([labelTitle]);
    },
  );

  test(
    'filters tasks by completion state',
    { tag: ['@app', '@task-management', '@regression', '@req:REQ-API-004'] },
    async ({ api, data, cleanup }) => {
      const project = await createProject(api, cleanup, data.projectName('Quarter close'));
      const open = await createTask(api, project.id, data.taskName('Still open'));
      const closed = await createTask(api, project.id, data.taskName('Already done'));

      const updated = await expectJson<Task>(
        await api.post(`/api/v1/tasks/${closed.id}`, { data: { done: true } }),
        200,
        'id',
      );
      expect(updated.done).toBe(true);

      const all = await expectJson<Task[] & { length: number }>(
        await api.get(`/api/v1/projects/${project.id}/tasks`),
        200,
        'length',
      );
      expect(all.map((t) => t.id).sort()).toEqual([open.id, closed.id].sort());

      const response = await api.get(`/api/v1/projects/${project.id}/tasks`, { params: { filter: 'done = false' } });
      const openOnly = await expectJson<Task[] & { length: number }>(response, 200, 'length');
      // The filter must exclude the completed task, not merely include the open one —
      // an assertion that only checks for `open` passes against a broken filter.
      expect(openOnly.map((t) => t.id)).toEqual([open.id]);
    },
  );

  test(
    'rejects an unauthenticated request',
    { tag: ['@app', '@task-management', '@regression', '@req:REQ-API-005'] },
    async () => {
      // A deliberately anonymous context: the `api` fixture carries the session, and the
      // point of this test is what happens without one.
      const anonymous = await request.newContext({ baseURL: process.env.APP_API_URL || process.env.BASE_URL });
      expect((await anonymous.get('/api/v1/projects')).status()).toBe(401);
      await anonymous.dispose();
    },
  );
});
