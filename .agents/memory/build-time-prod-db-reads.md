---
name: Build-time prod DB reads deadlock first publish of a new table
description: Why a build step that queries the production DB for a brand-new table fails the very first publish, and how to keep the build resilient.
---

# Build-time prod DB reads and the first-publish deadlock

The geo-quiz production build runs `prerender.mjs`, which connects to the
**production** database during the BUILD phase to discover dynamic routes.

**The trap:** Replit applies the dev→prod schema diff only AFTER a successful
build (during publish). So the first publish that introduces a brand-new table
AND queries it at build time cannot see that table yet — the query throws
Postgres `42P01` (`relation "x" does not exist`), and if that crashes the build,
the publish never completes, so the schema is never applied. Deadlock: every
retry fails the same way.

**Rule:** any build-time read of the prod DB for a *newly added, non-critical*
table must tolerate a missing relation. Catch `42P01` only and return empty rows;
re-throw everything else (connectivity, syntax, missing required tables) so real
problems still fail the build loudly. Do NOT broaden the catch to `42703`
(missing column) — that can mask real schema drift/query bugs.

**Why:** the publish-time diff is the ONLY supported way to migrate prod schema
(see database skill). You must NOT fix this with prod DDL, a migrate-prod script,
a deploy-build `db:push` hook, or startup-time DDL. Making the build resilient is
the right lever; after the first publish succeeds, the table exists and the next
build prerenders its routes normally.

**How to apply:** for required existing surfaces (quizzes, categories, courses)
keep queries fail-fast. For each new optional table queried at build time, route
it through a tolerant helper (`queryOptionalTable` in `prerender.mjs`). Runtime
route handlers (`api-server` `ssr-pages.ts`, `sitemap.ts`) do NOT need this — they
only run after a successful publish, when the schema diff is already applied.
