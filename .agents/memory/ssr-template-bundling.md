---
name: api-server bundles AND serves the full frontend build (shell + assets)
description: Why the api-server ships and serves its own copy of the entire geo-quiz dist/public instead of relying on the separate static layer in production.
---

On autoscale, each artifact runs in its own process container. The geo-quiz
built `dist/public` is served from a SEPARATE static layer that is NOT present
on the api-server process's filesystem at runtime, and the two artifacts build
geo in SEPARATE environments. So the static layer's content-hashed `/assets`
files can diverge from the hashes baked into the SSR shell the api-server
renders.

**Symptom of getting this wrong (the original prod bug):** the site renders SSR
HTML but is completely UNSTYLED with no React hydration. `GET /assets/index-*.js`
and `/assets/index-*.css` return HTTP 200 but `content-type: text/html` (the
~6.6KB SPA shell) — because the asset files the shell references aren't in the
static layer, the request falls through to the api-server `/*splat` catch-all
(`serveSpaFallback`) and gets the HTML shell instead of JS/CSS.

**Rule:** the api-server is the single source of truth for BOTH the SSR shell
AND the hashed assets.
- `build.mjs` copies the ENTIRE `geo-quiz/dist/public` into the api-server's own
  bundle (`dist/public`), not just the shell.
- The SSR shell is read bundle-relative (`dist/public/spa-template.html` via
  `import.meta.url`), never from `artifacts/geo-quiz/dist/...` at runtime.
- In the production branch, `app.ts` mounts
  `express.static(BUNDLED_PUBLIC_DIR, { index: false, redirect: false })` with
  immutable cache headers for `/assets`, registered BEFORE `ssrPagesRouter` (and
  after `sitemapRouter` and `/api`). So the api-server serves the real assets
  itself and the static layer becomes a non-critical front cache.

**Why `index: false` + `redirect: false`:** `dist/public` contains prerendered
`<route>/index.html` SEO snapshots. These flags stop express.static from
shadowing the live SSR handlers for `/`, `/quiz/:id`, `/category/:slug`,
`/courses`, `/daily`, `/privacy`. (Direct `.html` file URLs can still be served
from the snapshots; harmless — they reference the same assets.)

**Build commands:** both artifact.toml production builds are UNCONDITIONAL (no
`[ -f spa-template.html ]` guard) so each env always rebuilds geo fresh and the
api-server always bundles the CURRENT assets that match the CURRENT shell. Edit
these via `verifyAndReplaceArtifactToml` (write a sibling `artifact.edit.toml`
first); direct edits to `artifact.toml` and `.replit` are forbidden.

**How to apply:** any time you touch the api-server build, SSR template
resolution, or the artifact.toml build commands, preserve full-public bundling +
bundle-relative serving + the express.static asset mount. Do NOT reintroduce a
runtime dependency on the sibling geo dist or a conditional build guard that
assumes a shared filesystem / single build.
