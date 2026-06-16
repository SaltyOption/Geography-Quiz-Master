---
name: Clerk dev/prod user IDs and admin allow-list
description: Why admin works in the editor preview but not on the published custom domain when admin is gated by Clerk user ID.
---

Replit-managed Clerk has **separate development and production user stores** — the same email gets a *different* `user_...` ID in each. An admin allow-list keyed by Clerk user ID (here `ADMIN_USER_IDS`, read by `requireAdmin`/`isRequestAdmin`) therefore needs BOTH the dev ID and the prod ID; a dev-only ID makes admin work in the editor preview but silently fail on the published domain (signed in, but treated as a regular user).

**Why:** dev uses `pk_test`/`sk_test` (dev instance), prod uses live keys (prod instance) — user records never cross over.

**How to apply:** to get the production ID, have the user sign in on the *live* domain and open `/admin`; the "Not yet an admin" bootstrap card (`AdminGuard.tsx`) displays their current Clerk user ID. Append it to `ADMIN_USER_IDS` (shared env), keeping the dev ID, then **re-publish** — env/secret changes only reach production on a new deploy. The editor's Clerk key can't query the prod instance, so you cannot look up the prod ID yourself.
