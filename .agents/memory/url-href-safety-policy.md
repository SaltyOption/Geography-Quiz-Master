---
name: URL href safety policy
description: Every render path AND the write path must apply the same http(s)-only check before turning a stored/user URL into an <a href>.
---

Any stored or admin/user-authored URL that becomes an `<a href>` must be gated by
`isSafeHttpUrl` (exported from `lib/markdown`, `@workspace/markdown`) — the single
http(s)-only policy. `javascript:`/`data:` schemes must never reach an href.

**Why:** the "Did You Know" factoid `sourceUrl` was rendered directly as
`<a href={sourceUrl}>` on the public client page while SSR and prerender already
guarded it. That left a stored link-XSS hole reachable only on the hydrated client
path. The lesson: guarding *some* render paths is not enough — a stored URL flows
through four places that must all agree.

**How to apply:** when adding any feature that stores a URL and later renders it as
a link, apply the check in **all** of these:
- the React client render (`isSafeHttpUrl` before emitting `<a>`)
- production SSR (`artifacts/api-server/.../ssr-pages.ts`)
- the prerender script (`artifacts/geo-quiz/prerender.mjs`)
- the **write path** (server create/update): normalize empty → null, reject
  non-http(s) with 400, so a bad value can never be persisted in the first place.

For Markdown bodies use `renderMarkdown` (same lib) — it already escapes input and
restricts link hrefs to http(s)/relative, so `dangerouslySetInnerHTML` on its
output is safe.
