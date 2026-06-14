---
name: Dev vs prod frontend routing split
description: Why the API server proxies to Vite in dev, and why route ownership must not be reverted
---

# Frontend delivery is environment-split

**Rule:** In production the `api-server` artifact owns `/` and all HTML routes
(`/quiz`, `/category`, `/courses`, plus a catch-all) and renders fresh SSR HTML
from the prebuilt frontend at `artifacts/geo-quiz/dist/public`. The `geo-quiz`
artifact only owns static asset paths (`/assets/`, `/favicon.svg`, etc.). This
was done for SEO (crawlers get live DB-driven HTML, not a build-time snapshot).

**Why it breaks dev:** `artifact.toml` `paths` are shared between dev and prod,
so the proxy routes `/` to the API server in dev too. But there is no frontend
build in development, so the SSR template is missing and the API server served a
bare, unstyled crawlable HTML fallback — the preview showed plain-text links
with no CSS/React.

**The fix (keep it):** In development only (`NODE_ENV === "development"`), the
API server proxies all non-`/api`, non-`/sitemap.xml` traffic (including HMR
WebSocket upgrades) to the Vite dev server. Production is untouched.

**How to apply:**
- Do NOT "fix" anything here by giving `/` ownership back to `geo-quiz` in
  `artifact.toml` — that reverts the prod SSR architecture and loses homepage SEO.
- The dev proxy target defaults to `http://localhost:26064` (the geo-quiz dev
  PORT). If that port ever changes, set `WEB_DEV_URL` for the api-server.
- Keep the dev gate as `=== "development"` (fail-closed): a non-prod, non-dev
  env must NOT silently proxy instead of doing SSR.
