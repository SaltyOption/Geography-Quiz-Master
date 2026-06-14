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
- The public site is currently a React + Vite SPA with client-side routing.
- Public discovery pages do not have server-rendered or prerendered route HTML today.
- Route-level SEO improvements will have the most impact if they are implemented through SSR, SSG, or a prerender pipeline rather than client-only head mutation.

## Dismissed categories
- (None yet)
