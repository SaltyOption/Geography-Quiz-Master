---
name: Prod data & admin setup
description: Why a published app can show an empty site / no admin, and the supported ways to fix it (separate prod DB, Publish "overwrite data", shared-env admin IDs, single Clerk instance).
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
- Dev and prod share ONE Clerk instance (publishable key is `pk_test_` in both),
  so a user's Clerk ID is identical across environments — the same admin ID works
  in prod. Verify with `printf %s "$VITE_CLERK_PUBLISHABLE_KEY" | cut -c1-8`.
- Therefore "can't log in as admin" on the live site is usually just being signed
  OUT there: sign in with the admin Clerk account. If the Admin link still doesn't
  appear after signing in, republish so the running deployment picks up the env.
- Bootstrap if the ID is unknown: visit `/admin` while signed in (non-admin) — the
  page prints your Clerk user ID to add to `ADMIN_USER_IDS`.

**How to apply:** when a freshly deployed app shows no content / no admin, check
`executeSql({environment:"production"})` counts vs dev BEFORE touching code — it is
almost always a data/config gap, not a bug.
