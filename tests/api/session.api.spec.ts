import { test, expect } from '../../fixtures';
import { request } from '@playwright/test';
import { registerAccount } from '../../features/step-definitions/support/demo-account';

/**
 * Authorization and session lifetime, asserted at the API where the answers are real.
 *
 * The browser can only show you what a client chose to render. Whether another
 * account can reach your data, and whether signing out actually ends anything, are
 * questions only the server can answer.
 */
test.describe('API — authorization and session', () => {
  test(
    'a project cannot be reached by another account',
    { tag: ['@app', '@task-management', '@smoke', '@req:REQ-API-006'] },
    async ({ api, data, cleanup }) => {
      const mine = await api.put('/api/v1/projects', { data: { title: data.projectName('Private') } });
      expect(mine.status()).toBe(201);
      const { id } = await mine.json();
      cleanup.register(`project ${id}`, () => api.delete(`/api/v1/projects/${id}`));

      // A second account, provisioned for this test alone. Rejecting NO session
      // (REQ-API-005) is a far weaker claim than rejecting the WRONG one, and it is
      // the wrong one that a regulated buyer asks about.
      const anon = await request.newContext({ baseURL: process.env.APP_API_URL || process.env.BASE_URL });
      const other = await registerAccount(anon, `other${Date.now()}`);
      const login = await anon.post('/api/v1/login', { data: other });
      expect(login.status()).toBe(200);
      const { token } = await login.json();
      await anon.dispose();

      const stranger = await request.newContext({
        baseURL: process.env.APP_API_URL || process.env.BASE_URL,
        extraHTTPHeaders: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      // Every verb, not just read. An application that hides a project from a list
      // while still accepting a DELETE for it is not protecting anything.
      for (const [label, response] of [
        ['read', await stranger.get(`/api/v1/projects/${id}`)],
        ['list tasks', await stranger.get(`/api/v1/projects/${id}/tasks`)],
        ['update', await stranger.post(`/api/v1/projects/${id}`, { data: { title: 'taken over' } })],
        ['delete', await stranger.delete(`/api/v1/projects/${id}`)],
      ] as const) {
        expect(response.status(), `${label} by another account must be refused`).toBe(403);
      }
      await stranger.dispose();

      // The control: refusing everyone would also satisfy the assertions above.
      expect((await api.get(`/api/v1/projects/${id}`)).status()).toBe(200);
    },
  );

  test(
    'signing out does not revoke the token server-side — a provider characteristic',
    { tag: ['@app', '@task-management', '@regression'] },
    async ({ api }) => {
      // A CHARACTERISATION test. The UI scenario for REQ-AUTH-004 proves the browser
      // session ends; this records what does NOT happen, which is the half a browser
      // cannot show you.
      //
      // Measured against v2.5.0: POST /user/logout answers 200, and the same bearer
      // token keeps working afterwards. That is the usual trade-off of stateless JWTs
      // rather than a defect — but it means a leaked token survives the user clicking
      // "log out", which is exactly the kind of thing a security review asks about and
      // a green tick on a UI test would have hidden.
      //
      // If Vikunja ever adds revocation, this test fails and tells us to strengthen
      // the claim in requirements/AUTH.md.
      expect((await api.get('/api/v1/projects')).status()).toBe(200);

      const logout = await api.post('/api/v1/user/logout');
      expect(logout.status(), 'the endpoint exists and reports success').toBe(200);

      expect((await api.get('/api/v1/projects')).status(), 'the token still works — sign-out is client-side only').toBe(
        200,
      );
    },
  );
});
