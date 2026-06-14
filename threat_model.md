# Threat Model

## Project Overview

World Geography Trivia is a public full-stack quiz platform with a React frontend (`artifacts/geo-quiz`) and an Express 5 API (`artifacts/api-server`) backed by PostgreSQL via Drizzle ORM. Visitors can browse and play quizzes without an account, signed-in users can persist progress and newsletter preferences through Clerk-backed sessions, and admins can manage quizzes, questions, categories, newsletter subscribers, and course content.

Production assumption for this project: the deployed app is public, `NODE_ENV` is `production`, transport security is handled by the platform, and only code reachable through the production frontend/API should be scanned. Mockup sandboxes, tests, generated dist output, and local-only tooling are out of scope unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — Clerk session cookies/tokens and user identifiers. Compromise would let an attacker impersonate players or admins.
- **Admin privileges** — `ADMIN_USER_IDS`-based authorization gates all content-management and subscriber export actions. A bypass would allow quiz/course modification and subscriber disclosure.
- **Quiz/course answer keys and content** — questions, explanations, fun facts, and correct answers are the core content asset. Premature disclosure can undermine quiz integrity and enable scraping.
- **User progress and attempt history** — saved quiz attempts, course attempts, and in-progress module answers reveal learning behavior and should stay scoped to the owning user.
- **Newsletter subscriber data** — subscribed email addresses are user PII and admin-only business data.
- **Application secrets** — Clerk secret key, database credentials, and admin user configuration must never leak to clients or logs.
- **Service availability** — public endpoints that parse large payloads or write to the database are abuse targets because the deployment is internet-accessible.

## Trust Boundaries

- **Browser to API** — all client input is untrusted. Public, authenticated, and admin routes must validate and authorize server-side.
- **API to PostgreSQL** — the API has broad read/write database access. Injection or unbounded write paths can expose or exhaust core data.
- **API to Clerk** — the server relies on Clerk for user identity and email lookup. Requests crossing this boundary must not leak secrets, and failures must not degrade authorization decisions.
- **Public to authenticated boundary** — quiz browsing is public, but stored progress, newsletter preferences, and course module access depend on a valid user session.
- **Authenticated to admin boundary** — content management, bulk import, and subscriber export must be enforced only on the server via `requireAdmin`.
- **Production to dev/test boundary** — tests, mockup sandboxes, dist artifacts, and local harnesses should normally be ignored during production scans.

## Scan Anchors

- **Production API entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`
- **Highest-risk code areas:** auth/admin gating in `src/middlewares/requireAdmin.ts`; public scoring/write flows in `src/routes/quiz-attempts.ts`; content reads in `src/routes/quizzes.ts`, `questions.ts`, `categories.ts`; course persistence/import in `src/routes/courses.ts`; newsletter PII in `src/routes/newsletter.ts`
- **Public surfaces:** quiz/category/course reads, quiz attempt submission, health
- **Authenticated surfaces:** `/user/progress`, `/newsletter/me`, course module access/progress/attempts
- **Admin surfaces:** quiz/question/category CRUD, bulk import/export, newsletter subscriber export, admin course endpoints
- **Usually dev-only / ignore unless proven reachable:** `artifacts/mockup-sandbox`, `**/*.test.ts*`, `dist/`, local scripts

## Threat Categories

### Spoofing

The application trusts Clerk for end-user identity and uses `ADMIN_USER_IDS` for elevated access. Every authenticated or admin endpoint must derive identity from Clerk server-side state, never from client-supplied user IDs or role flags, and admin checks must fail closed when configuration is absent or lookup fails.

### Tampering

The client can submit quiz answers, course progress, and admin import payloads. The server must treat all body, params, and query values as attacker-controlled, enforce schema and ownership checks, and ensure users cannot alter data outside their own account or bypass quiz/course rules through crafted payloads.

### Information Disclosure

The API serves quiz content, progress history, newsletter data, and Clerk-derived user information. Sensitive responses must be scoped by publication status, ownership, and role; subscriber exports must remain admin-only; secrets and session material must not appear in logs or proxy responses; and answer keys should only be revealed at the point intended by product policy.

### Denial of Service

Because the deployment is public, unauthenticated or low-privilege users can repeatedly hit JSON endpoints. Request bodies, array lengths, expensive database fan-out, and write amplification must be bounded so that bulk submissions, import payloads, or repeated attempt creation cannot exhaust CPU, memory, or database storage.

### Elevation of Privilege

The main privilege boundaries are public → authenticated and authenticated → admin. Server routes must not rely on frontend guards for protection, and content-management or subscriber endpoints must remain unreachable without `requireAdmin`. Data reads and writes must also avoid IDOR-style access to another user’s progress or hidden draft content.