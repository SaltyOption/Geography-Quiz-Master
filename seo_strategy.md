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
- Crawlability assets served with the public frontend:
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
- The public site is a React + Vite app deployed as static files with client-side routing and a build-time prerender step.
- `prerender.mjs` currently emits route-specific HTML for `/`, `/daily`, `/courses`, `/privacy`, `/quiz/:id`, `/category/:slug`, and `/courses/:slug`, so public pages are no longer a pure client-only SPA for first-request metadata.
- The remaining architectural SEO risk is freshness: prerendered HTML and crawl assets are generated only at build time, while admins can keep changing quizzes, categories, and courses after deploy.
- Route-level SEO improvements now depend on keeping prerendered HTML, canonicals, structured data, and sitemap data aligned with the configured production domain and regenerated when public content changes.

## Dismissed categories
- (None yet)
