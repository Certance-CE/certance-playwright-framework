import { test, expect } from '../../fixtures';
import { z } from 'zod';
import { expectSchema, validateSchema } from '../../utils/contract';

/**
 * Contract checks against the LIVE application.
 *
 * `framework-tests/contract.spec.ts` proves the validators work; it does so entirely offline,
 * against objects written by hand in the same file. That proves the code, not the
 * contract — a schema can only detect provider drift if it has been run against
 * what the provider actually sends. These tests do that.
 *
 * WHAT TO PUT IN A SCHEMA
 *
 * Only the fields the suite depends on. Vikunja's task resource carries around
 * thirty; asserting all of them turns every harmless upstream addition into a
 * failed build, and teams respond to that by deleting the check. Assert what you
 * rely on and let the rest vary.
 *
 * These schemas are deliberately NOT `.strict()`. A provider ADDING a field is
 * backwards-compatible and must not fail. Dropping one, or changing its type, is
 * what breaks callers — and that is exactly what a non-strict schema still catches.
 */

/** The user shape embedded in an owner/assignee position. */
const User = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1),
});

const Project = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string(),
  is_archived: z.boolean(),
  is_favorite: z.boolean(),
  parent_project_id: z.number().int(),
  owner: User,
});

const Task = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string(),
  done: z.boolean(),
  project_id: z.number().int().positive(),
  priority: z.number().int(),
  percent_done: z.number(),
  // Vikunja numbers tasks per project and exposes BOTH: `index` as a number and
  // `identifier` as the display string ("#1"). The pair is worth pinning, because
  // swapping them is the kind of change that would otherwise surface as a puzzling
  // rendering bug rather than a failed test.
  //
  // `identifier` is only loosely typed HERE because the update endpoint really does
  // return an empty one — see IdentifiedTask below and the characterisation test at
  // the end of this file.
  index: z.number().int().positive(),
  identifier: z.string(),
  // Absent rather than empty when a task carries none.
  labels: z.array(z.object({ id: z.number(), title: z.string() })).nullable(),
});

/**
 * A task as every endpoint EXCEPT update returns it, with a populated `identifier`.
 *
 * The split is a finding, not a convenience. Measured against v2.5.0: create, fetch
 * and list all return "#1"; the update endpoint returns "". Loosening `Task` for all
 * four would have hidden that, which is the failure mode contract testing is supposed
 * to prevent — so the endpoints that DO honour the contract are held to it.
 */
const IdentifiedTask = Task.extend({ identifier: z.string().startsWith('#') });

const Label = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  hex_color: z.string(),
});

/** The unauthenticated service descriptor a client reads before doing anything else. */
const ServiceInfo = z.object({
  version: z.string().min(1),
  link_sharing_enabled: z.boolean(),
  max_file_size: z.string(),
});

test.describe('API contract — live responses', () => {
  test(
    'the project resource matches its contract',
    { tag: ['@app', '@task-management', '@smoke', '@req:REQ-API-007'] },
    async ({ api, data, cleanup }) => {
      const created = await expectSchema(
        await api.put('/api/v1/projects', { data: { title: data.projectName('Contract') } }),
        Project,
        'PUT /projects',
      );
      cleanup.register(`project ${created.id}`, () => api.delete(`/api/v1/projects/${created.id}`));

      // Read-back must satisfy the SAME schema. A provider that returns a richer
      // object on create than on fetch is a classic source of "works when I create
      // it, breaks when I reload".
      const fetched = await expectSchema(
        await api.get(`/api/v1/projects/${created.id}`),
        Project,
        'GET /projects/{id}',
      );
      expect(fetched.id).toBe(created.id);
    },
  );

  test(
    'the task resource matches its contract, before and after completion',
    { tag: ['@app', '@task-management', '@smoke', '@req:REQ-API-008'] },
    async ({ api, data, cleanup }) => {
      const project = await expectSchema(
        await api.put('/api/v1/projects', { data: { title: data.projectName('Contract') } }),
        Project,
      );
      cleanup.register(`project ${project.id}`, () => api.delete(`/api/v1/projects/${project.id}`));

      const task = await expectSchema(
        await api.put(`/api/v1/projects/${project.id}/tasks`, { data: { title: data.taskName('Contract') } }),
        IdentifiedTask,
        'PUT /projects/{id}/tasks',
      );
      expect(task.done).toBe(false);

      // The shape must survive a state change, not only creation.
      const completed = await expectSchema(
        await api.post(`/api/v1/tasks/${task.id}`, { data: { done: true } }),
        Task,
        'POST /tasks/{id}',
      );
      expect(completed.done).toBe(true);

      const listed = await expectSchema(
        await api.get(`/api/v1/projects/${project.id}/tasks`),
        z.array(IdentifiedTask),
        'GET /projects/{id}/tasks',
      );
      expect(listed).toHaveLength(1);
    },
  );

  test(
    'the label resource matches its contract',
    { tag: ['@app', '@task-management', '@regression', '@req:REQ-API-009'] },
    async ({ api, data, cleanup }) => {
      const label = await expectSchema(
        await api.put('/api/v1/labels', { data: { title: data.unique('contract'), hex_color: '4287f5' } }),
        Label,
        'PUT /labels',
      );
      cleanup.register(`label ${label.id}`, () => api.delete(`/api/v1/labels/${label.id}`));
      expect(label.hex_color).toBe('4287f5');
    },
  );

  test(
    'the public service descriptor matches its contract',
    { tag: ['@app', '@task-management', '@regression', '@req:REQ-API-010'] },
    async ({ api }) => {
      // Unauthenticated: a client reads this before it has a session, so a change
      // here breaks users who cannot even sign in yet.
      await expectSchema(await api.get('/api/v1/info'), ServiceInfo, 'GET /info');
    },
  );

  test(
    'drift in a live response is detected, and only the drifted field is named',
    { tag: ['@app'] },
    async ({ api, data, cleanup }) => {
      // The proof that the checks above are load-bearing rather than decorative.
      //
      // `identifier` really is a string ("#1"). This schema expects a number, modelling
      // a provider that changed the type — the commonest kind of silent drift. It runs
      // against the REAL task body, so it cannot pass by agreeing with a stub the way
      // an offline self-test can.
      const project = await expectSchema(
        await api.put('/api/v1/projects', { data: { title: data.projectName('Drift') } }),
        Project,
      );
      cleanup.register(`project ${project.id}`, () => api.delete(`/api/v1/projects/${project.id}`));
      const real = await (
        await api.put(`/api/v1/projects/${project.id}/tasks`, { data: { title: data.taskName('Drift') } })
      ).json();

      // Sanity: the unmodified body satisfies the real contract, so any failure below
      // is attributable to the one changed expectation and nothing else.
      validateSchema(real, IdentifiedTask, 'GET /tasks/{id}');

      const act = () => validateSchema(real, Task.extend({ identifier: z.number() }), 'GET /tasks/{id}');
      expect(act).toThrow('API contract drift — GET /tasks/{id}');
      expect(act).toThrow(/identifier/); // the offending path is named, not merely "invalid"
      // Precision matters as much as detection: a report that also blamed innocent
      // fields would send whoever reads it hunting in the wrong place.
      expect(act).not.toThrow(/title/);
    },
  );

  test(
    'the update endpoint returns an empty task identifier — a provider inconsistency',
    { tag: ['@app'] },
    async ({ api, data, cleanup }) => {
      // A CHARACTERISATION test: it records what the application does today, including
      // the part that is wrong, so a change in either direction is visible.
      //
      // Found by the checks above on their first live run, and confirmed against
      // v2.5.0: create, fetch and list all return `identifier: "#1"`, while the update
      // endpoint returns `""` for the very same task. `index` stays correct throughout,
      // so the number is not lost — only its rendered form.
      //
      // A client that redisplays a task from the update response therefore shows a
      // blank reference where every other screen shows "#1". It is a defect in the
      // application under test, NOT in this suite, so it is documented rather than
      // smoothed over by loosening every schema. If Vikunja fixes it, this test fails
      // and tells us to tighten `Task`.
      const project = await expectSchema(
        await api.put('/api/v1/projects', { data: { title: data.projectName('Identifier') } }),
        Project,
      );
      cleanup.register(`project ${project.id}`, () => api.delete(`/api/v1/projects/${project.id}`));

      const created = await expectSchema(
        await api.put(`/api/v1/projects/${project.id}/tasks`, { data: { title: data.taskName('Identifier') } }),
        IdentifiedTask,
      );
      expect(created.identifier).toMatch(/^#\d+$/);

      const updated = await expectSchema(await api.post(`/api/v1/tasks/${created.id}`, { data: { done: true } }), Task);
      expect(updated.identifier, 'update still omits the identifier').toBe('');
      expect(updated.index, 'the underlying number is intact — only its rendering is lost').toBe(created.index);

      // Fetching the same task afterwards restores it, which is what makes the update
      // response the odd one out rather than the task being genuinely unidentified.
      const refetched = await expectSchema(await api.get(`/api/v1/tasks/${created.id}`), IdentifiedTask);
      expect(refetched.identifier).toBe(created.identifier);
    },
  );
});
