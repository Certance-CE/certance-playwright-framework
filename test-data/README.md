# test-data/

Static fixtures and any state the suite needs on disk.

| Path     | Purpose                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- |
| `.auth/` | Saved `storageState` produced by the auth seed. **Git-ignored** — never commit a session. |

## The rule for pre-seeded records

If a test depends on a record that already exists in the application (a known user, a
seeded project, a fixed catalogue item), document it here with its identifier and what
the test expects of it. A test that silently depends on undocumented state is a test that
breaks for the next person and nobody knows why.

Prefer creating what you need at run time through the `api` fixture and disposing it with
the `cleanup` fixture. Reach for pre-seeded data only when creating it is impossible or
prohibitively slow.

## What must never live here

Real customer data, production exports, credentials, or anything containing PII. Synthetic
data comes from the `data` fixture (see `skills/core/test-data.md`).
