---
name: Prod data & admin setup
description: Why a published app can show an empty site / no admin, and the supported ways to fix it (separate prod DB, Publish "overwrite data", shared-env admin IDs, SEPARATE dev/prod Clerk user stores).
---

# Production data & admin access

**Dev and prod use SEPARATE managed Postgres databases.** Publishing copies the
SCHEMA (via the publish-time diff), NOT the content. So a site that looks full in
dev can show an empty production site even though the deploy "succeeded."

**To copy dev content to prod:** the user picks the **"overwrite data"** option in
the Publish UI (replaces prod data with dev data wholesale).
**Why:** it is the only supported path. NEVER write seed scripts, prod migration
scripts, deploy-build DB hooks, or startup-time DDL/seeding to populate prod — the
database skill forbids it. Caveat to tell the user: overwrite replaces ALL prod
data (attempts, subscribers, etc.); safe only when prod has no real data yet.

**Admin access in production:**
- `ADMIN_USER_IDS` belongs in the **shared** managed env (shows as
  `[userenv.shared]` in `.replit`), which reaches BOTH dev and prod. Seeing it in
  `.replit` under `[userenv.shared]` is correct — it is NOT a hardcoded secret;
  `viewEnvVars` confirms it under `envVars.shared`.
- Dev and prod are SEPARATE Clerk instances with SEPARATE user stores (dev uses
  `pk_test_`/`sk_test_`, prod uses live keys). The same email gets a DIFFERENT
  `user_...` ID in each, so a dev-only admin ID works in the editor preview but
  NOT on the published domain. `ADMIN_USER_IDS` must contain BOTH the dev ID and
  the prod ID. See `clerk-admin-dev-prod-ids.md`.
- "Can't log in as admin" on the live site (signed IN but treated as a regular
  user) is almost always the missing prod ID, not being signed out.
- Get the prod ID: sign in on the LIVE domain and visit `/admin`; the "Not yet an
  admin" card prints the current Clerk user ID. Append it to `ADMIN_USER_IDS`
  (shared env), keep the dev ID, then RE-PUBLISH (env changes only reach prod on a
  new deploy). The editor's `sk_test` key cannot look up the prod ID for you.

**How to apply:** when a freshly deployed app shows no content / no admin, check
`executeSql({environment:"production"})` counts vs dev BEFORE touching code — it is
almost always a data/config gap, not a bug.
