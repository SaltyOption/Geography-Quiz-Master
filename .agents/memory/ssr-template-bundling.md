---
name: SSR template must be bundled into api-server, not read from sibling artifact
description: Why the api-server ships its own copy of the geo-quiz SPA shell instead of reading the geo-quiz dist at runtime in production.
---

On autoscale, each artifact runs in its own process container. The geo-quiz
static files (its built `dist/public`) are served from a SEPARATE static layer
and are NOT present on the api-server process's filesystem at runtime. So the
api-server cannot read the frontend's `index.html`/SPA shell from the sibling
artifact's dist at request time in production — it resolves to nothing and the
SSR layer falls back to an unstyled, JS-less page (the original prod bug).

**Rule:** the SSR HTML template the api-server injects into must be copied INTO
the api-server's own bundle at build time and read bundle-relative
(`import.meta.url` → `dist/web-template.html`), never read from
`artifacts/geo-quiz/dist/...` at runtime. The frontend writes a pristine
empty-`#root` shell (with hashed `/assets` JS+CSS tags, captured before
per-route prerender mutates index.html); the api-server build copies it and
fails closed when `NODE_ENV=production` and it's missing.

**Why:** separate static vs process layers in autoscale; the runtime container
has no access to the other artifact's build output.

**How to apply:** any time the api-server SSR-renders HTML that needs the
frontend's hashed asset tags, the template must travel inside the api-server
bundle. The frontend must be built before (or by) the api-server build so its
shell exists to copy — enforced via the artifact.toml production build commands
(both guard on the same shell file), NOT via `.replit` (direct edits forbidden).
One canonical, deterministic vite build feeds both the static layer and the
copied shell, so asset hashes stay consistent.
