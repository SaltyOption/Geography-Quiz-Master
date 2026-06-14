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
- Express now serves the live homepage, `/quiz/:id`, `/category/:slug`, `/courses`, `/courses/:slug`, and `/sitemap.xml`.
- The static frontend artifact still serves JS/CSS assets plus static crawler assets such as `robots.txt`, `llms.txt`, `favicon.svg`, and `opengraph.jpg`.
- Public SPA routes that do not have dedicated SSR handlers, notably `/daily` and `/privacy`, currently depend on the API server's raw-template fallback path.
- Route-level SEO work must therefore check three separate crawler-visible surfaces:
  1. live SSR HTML from `artifacts/api-server/src/routes/ssr-pages.ts`,
  2. static crawler assets in the Vite `dist/public` output,
  3. post-hydration React enhancements that may or may not be visible to non-rendering crawlers.
- The main architecture risks are now:
  - fallback routing leaking homepage HTML onto other public SPA routes,
  - stale references between static crawler assets and live server routes,
  - parity gaps where live SSR returns thinner HTML than the richer React pages.

## Dismissed categories
- (None yet)
