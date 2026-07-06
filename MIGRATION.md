# Replit → Railway Migration Runbook

Status: repo-side changes are done (see git history). This file tracks the
manual, dashboard/DNS-side steps. Delete it once the cutover is complete.

The old Replit deployment keeps serving worldgeographytrivia.com untouched
until the DNS flip in step 6 — nothing here interrupts it. Do NOT redeploy on
Replit after merging these changes (the `.replit` config is gone).

## 1. Clerk — the highest-risk item

The current Clerk instance is **managed by Replit** (auth was configured
through Replit's Auth pane; there is no self-owned Clerk dashboard). Leaving
Replit means owning the Clerk application yourself:

1. Create a Clerk account + application at clerk.com. Enable the same sign-in
   options (email/password + Google).
2. Export users from the Replit-managed instance while it still works: the
   `CLERK_SECRET_KEY` in the Replit Secrets pane authorizes the Clerk Backend
   API (`GET https://api.clerk.com/v1/users?limit=...`). Page through and save
   the JSON. Password hashes are NOT exportable this way — ask Clerk support
   for a hash export, or accept that users must reset passwords / re-auth with
   Google on first login after cutover.
3. Import users into the new application (Clerk's import API/CSV, or
   `POST /v1/users` per user; Google-OAuth users re-link automatically by
   email).
4. **Admin IDs change on import.** `ADMIN_USER_IDS` holds Clerk user IDs from
   the old instance — after cutover, sign in, visit `/admin` (it shows your new
   user ID), and set the new value.
5. Configure the production instance's domain in Clerk. The app proxies the
   Clerk Frontend API through `/api/__clerk` (`clerkProxyMiddleware`), so in
   Clerk set the proxy URL to `https://worldgeographytrivia.com/api/__clerk`
   instead of using CNAME records.
6. Collect the new `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and
   `VITE_CLERK_PUBLISHABLE_KEY` (publishable key is the same value for both).

Sanity check before cutover: sign-in, sign-up, `/profile`, `/admin` on the
Railway preview domain using Clerk's development instance keys.

## 2. Railway project + Postgres

1. Create a Railway project; add a **Postgres** database service.
2. Copy production data across (from a machine that can reach both):
   `pg_dump --no-owner --no-acl "$REPLIT_DATABASE_URL" | psql "$RAILWAY_DATABASE_URL"`
   (get the Replit `DATABASE_URL` from the Replit Secrets pane; get the Railway
   one from the Postgres service's Variables tab, use the public/proxy URL for
   the dump-restore, the private one for the app).
3. Re-run the copy right before the DNS flip (step 6) so no quiz attempts,
   contact messages, or newsletter rows written in between are lost — or put
   the Replit app in a frozen window during cutover.

## 3. Railway web service

1. New service → Deploy from GitHub repo `SaltyOption/Geography-Quiz-Master`.
   It picks up `railway.json` automatically (build gate + pre-deploy
   `drizzle-kit push` + start command + `/api/healthz` health check).
2. Set service variables (available at build AND runtime — the build runs the
   broken-image gate against the production DB and bakes `VITE_*` values into
   the frontend bundle):
   - `DATABASE_URL` → reference the Postgres service (private network URL)
   - `NODE_ENV=production`
   - `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
   - `ADMIN_USER_IDS` (new-instance IDs, see step 1.4)
   - `VITE_CANONICAL_DOMAIN=https://worldgeographytrivia.com`
   - optional: `BROKEN_IMAGE_ALERT_WEBHOOK_URL`
3. Deploy; verify on the `*.up.railway.app` domain: home page, a quiz
   end-to-end, `/sitemap.xml`, `/api/healthz`, images under `/regions/` and
   `/landmarks/`, sign-in, `/admin`.
   Note: SSR/sitemap URLs will show the canonical domain, and Clerk runs
   against whatever keys are set — full auth verification may only be possible
   after the domain points at Railway.

## 4. Railway cron service (broken-image check)

1. Second service from the same repo; in service settings set
   **Config-as-code path** to `railway.cron.json` (daily at 06:00 UTC,
   `restartPolicyType: NEVER`).
2. Variables: `DATABASE_URL` (reference Postgres), optional
   `BROKEN_IMAGE_ALERT_WEBHOOK_URL`.

This replaces the Replit Scheduled Deployment. The Replit-managed Gmail
email channel was removed from the script; the webhook (Slack-compatible)
is the alert path now.

## 5. What replaced what

| Replit                                   | Railway                                        |
| ---------------------------------------- | ---------------------------------------------- |
| Autoscale deployment (artifact.toml)     | Web service via `railway.json`                 |
| `postMerge` hook (`pnpm --filter db push`) | `preDeployCommand` in `railway.json`         |
| Pre-deploy image gate in artifact build  | First step of `buildCommand` in `railway.json` |
| Scheduled Deployment (image check)       | Cron service via `railway.cron.json`           |
| Secrets pane                             | Service variables                              |
| Replit-managed Postgres                  | Railway Postgres service                       |
| Replit-managed Clerk (Auth pane)         | Self-owned Clerk application                   |
| Gmail connector email alerts             | Webhook alerts (`BROKEN_IMAGE_ALERT_WEBHOOK_URL`) |

## 6. Domain cutover

1. Re-run the data copy (step 2.3).
2. In Railway: add custom domain `worldgeographytrivia.com` (+ `www` if used)
   to the web service; it shows the CNAME/A records to set.
3. At the DNS registrar: replace the records currently pointing at Replit with
   Railway's. Keep TTL low (300s) beforehand to make the flip fast.
4. Verify on the live domain: quiz flow, sign-in (Clerk custom-domain proxy),
   `/admin`, `https://worldgeographytrivia.com/sitemap.xml`.
5. Watch Search Console for crawl errors over the following days (sitemap and
   canonical URLs are unchanged, so SEO impact should be nil).

## 7. Decommission

Only after the site has been stable on Railway for a comfortable window:

- Stop/delete the Replit autoscale deployment and the Scheduled Deployment.
- Keep the Replit workspace (read-only) until the Clerk user export and DB
  copy are confirmed good, then delete.
- Remove this file.
