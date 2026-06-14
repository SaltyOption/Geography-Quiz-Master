# SEO Strategy

## In scope
- Public marketing and discovery pages:
  - `/`
  - `/category/:slug`
  - `/quiz/:id`
  - `/daily`
  - `/courses`
  - `/courses/:slug`
  - `/privacy`
- Crawlability assets served with the public site:
  - `robots.txt`
  - `sitemap.xml`
  - `llms.txt`
  - favicon and social preview assets

## Out of scope
- Authenticated profile area (`/profile`)
- Authenticated course-taking routes (`/courses/:slug/modules/:moduleSlug`)
- Sign-in and sign-up flows
- Admin pages (`/admin/**`)

## Target audience
- People who want to learn geography through quizzes and short courses.

## Primary keywords
- geography quiz
- world geography trivia
- geography courses
- category-specific geography quizzes

## Current technical posture
- The production site is hybrid, not purely static.
- Static frontend artifact serves `/`, `/daily`, `/privacy`, `robots.txt`, `sitemap.xml`, `llms.txt`, favicon, and other public assets from the Vite build output.
- Express live SSR serves `/quiz/:id`, `/category/:slug`, `/courses`, and `/courses/:slug` in production.
- Route-level SEO work must therefore check three separate crawler-visible surfaces:
  1. shared static shell and prerender output,
  2. live SSR HTML from `artifacts/api-server/src/routes/ssr-pages.ts`,
  3. post-hydration React enhancements that may or may not be visible to non-rendering crawlers.
- The main architecture risks are now:
  - freshness mismatches between static root discovery assets and live database-backed routes,
  - parity gaps where live SSR returns thinner HTML than the richer React pages,
  - server-visible structured-data gaps on route families that no longer use the prerendered HTML files.

## Dismissed categories
- (None yet)
