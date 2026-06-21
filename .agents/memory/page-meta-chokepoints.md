---
name: Page meta description chokepoints
description: The three places that render per-page <meta description>/OG/Twitter tags and must stay in sync.
---

Per-page meta descriptions (description, og:description, twitter:description) are rendered in THREE independent places that must be kept in sync for any route-level override or change:

1. `artifacts/geo-quiz/prerender.mjs` — `injectHead()` (build-time static prerender of each route).
2. `artifacts/api-server/src/lib/ssrTemplate.ts` — `buildPageHtml()` AND `buildFallbackHtml()` (runtime SSR in prod + the no-template fallback).
3. `artifacts/geo-quiz/src/hooks/usePageMeta.ts` — `applyMeta()` (client-side updates on SPA navigation).

**Why:** prod serves prerendered/SSR HTML for first paint and link-preview crawlers, while the client hook updates tags after navigation. Editing only one path makes crawler-visible meta diverge from what users see, or makes some routes stale.

**How to apply:** the curated per-route override copy lives in shared lib `@workspace/seo-content` (`getMetaDescription(path)` + `META_DESCRIPTIONS` map keyed by full pathname; strips query/hash/trailing-slash). All three chokepoints call it as `getMetaDescription(path) ?? <existing/generated description>`, so unmapped routes (e.g. /quiz/:id) keep their DB/template description. Keys assume root deployment (BASE_PATH=/); a subpath deploy would need base-path stripping. Some copy embeds quiz counts ("2 quizzes") — those go stale if inventory changes and must be hand-updated. Map is code, not DB, deliberately (prod DB holds real user data; content can't be pushed to prod via tools, but code ships via Publish).
