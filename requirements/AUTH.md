---
epic: Authentication
journey: Sign in
priority: critical
---

# Authentication

Requirements for the sign-in journey, exercised against the self-hosted
reference application (`@app` lane).

## REQ-AUTH-001 — A user with valid credentials can sign in

**Priority:** critical

Given a registered account, submitting the correct username and password signs
the user in and lands them on their own workspace.

- Covered by: `features/auth.feature` → _Sign in with valid credentials_

## REQ-AUTH-002 — An incorrect password is rejected

**Priority:** critical

Submitting a valid username with the wrong password leaves the user signed out.
The application must not reveal whether the username exists.

- Covered by: `features/auth.feature` → _An incorrect password is rejected_

## REQ-AUTH-003 — A signed-in session survives a page reload

**Priority:** normal

Reloading the page while signed in returns the user to their workspace rather
than the login form.

- Covered by: `features/auth.feature` → _A signed-in session survives a page reload_

## REQ-AUTH-004 — Signing out ends the session

**Priority:** high

After signing out, the session is no longer usable: navigating back to an
authenticated route lands on the login form, and the stored token is gone.

- Covered by: `features/auth.feature` → _Signing out ends the browser session_

> Scope note: this requirement is about the **browser** session, which is what a user
> controls. The token is not revoked server-side — measured, and pinned by
> `tests/api/session.api.spec.ts`. That is the usual trade-off of stateless JWTs, but
> it means a leaked token outlives the user clicking "log out", and a UI-only test
> would have reported success while hiding it.
