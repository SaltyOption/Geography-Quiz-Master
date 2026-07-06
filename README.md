# World Geography Trivia

## Overview

World Geography Trivia — a full-stack geography quiz platform. Visitors can take geography quizzes and track their progress. Admins can manage quiz content. Users can create accounts to save their history.

Production: https://worldgeographytrivia.com

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Authentication**: Clerk (via setupClerkWhitelabelAuth)
- **Hosting**: Railway (web service + managed Postgres + cron job)

## Architecture

- `artifacts/geo-quiz` — React frontend (quiz UI + admin panel + auth)
- `artifacts/api-server` — Express backend API (with Clerk middleware)
- `lib/db` — Drizzle ORM schema (quizzes, questions, quiz_attempts tables)
- `lib/api-spec` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas

In production a single Express server (`api-server`) serves everything: the API, the SSR page shells, and every static file. Its build copies the entire geo-quiz `dist/public` into its own bundle (see `artifacts/api-server/build.mjs`), so the shell and every asset it references always come from one build and can never diverge.

## Local Development

```sh
pnpm install

# Terminal 1 — Vite dev server (the api-server proxies to it):
PORT=26064 BASE_PATH=/ pnpm --filter @workspace/geo-quiz run dev

# Terminal 2 — API server:
PORT=8080 pnpm --filter @workspace/api-server run dev

# Browse http://localhost:8080
```

Required env vars for a working local stack: `DATABASE_URL` (any Postgres), `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, and optionally `ADMIN_USER_IDS`. The api-server's dev proxy target can be overridden with `WEB_DEV_URL` (defaults to `http://localhost:26064`).

## Deployment (Railway)

Two services deploy from this repo:

1. **Web service** — uses [`railway.json`](railway.json):
   - **Build**: runs the broken-image pre-deploy gate (`check-db-image-files`, needs `DATABASE_URL` at build time), then builds the frontend and the api-server.
   - **Pre-deploy**: `pnpm --filter @workspace/db run push` (applies schema changes before the new code serves traffic).
   - **Start**: `node --enable-source-maps artifacts/api-server/dist/index.mjs`. Railway injects `PORT`.
   - **Health check**: `GET /api/healthz`.
2. **Scheduled broken-image check** — a second service from the same repo with its config path set to [`railway.cron.json`](railway.cron.json). Runs `check-db-image-files` daily against the production database (see below).

Service variables to set on the web service (build and runtime): `DATABASE_URL` (reference the Railway Postgres service), `NODE_ENV=production`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `ADMIN_USER_IDS`, `VITE_CANONICAL_DOMAIN=https://worldgeographytrivia.com`, and optionally `BROKEN_IMAGE_ALERT_WEBHOOK_URL` and `TRUST_PROXY_HOPS` (defaults to 1, correct for Railway's edge proxy). The cron service needs `DATABASE_URL` and optionally `BROKEN_IMAGE_ALERT_WEBHOOK_URL`.

## Features

### Public (no account required)
- Browse geography quizzes by category and difficulty
- Take any quiz — one question at a time with multiple choice
- After each answer: feedback, explanation, fun fact
- Final score and question-by-question results
- Share results from the results page to X, Facebook, or WhatsApp (or copy the result + quiz link). Uses the native Web Share sheet when available; the shared link points to the public quiz page so others can play. See `ShareResults.tsx`.

### Authenticated Users
- Create an account (email/password or Google)
- Quiz attempts automatically saved to their profile
- /profile page: stats (total quizzes, average score, best score)
- Recent attempt history per quiz with "Retake" links
- Completed quiz badges shown on home quiz cards

### Admin (/admin)
- Create, edit, delete quizzes
- Add, edit, delete questions per quiz
- Questions have: text, 4 options, correct answer, explanation, fun fact, optional image

## Draft / Published Visibility

- Both `quizzes` and `categories` have a `published` boolean column (notNull, default **false** — new content is a draft and hidden until an admin publishes it). Existing rows were backfilled to `published = true` at rollout.
- Server is the security boundary. The `isRequestAdmin(req)` helper (`middlewares/requireAdmin.ts`) drives read filtering:
  - Quizzes: list, detail, `/quizzes/:id/questions`, and `/quizzes/:id/stats` hide drafts from non-admins (detail/questions/stats return `404`). Responses include `published`.
  - Categories: list, `tree`, and `by-slug` hide drafts from non-admins. A category is visible only when it **and every ancestor** is published, so a published child of a draft parent never surfaces as an orphan. The tree counts only published quizzes for non-admins. `by-slug` returns `404` for a draft and filters draft descendants/quizzes/embedded category chips.
  - Daily quiz: **always** excludes drafts, even for admins (it must match what visitors can actually play).
- Create/update endpoints accept optional `published` (quizzes + categories) and pass it through. Bulk-imported quizzes default to draft.
- Admin UI: publish-now switch on quiz create and category create (default off); a published toggle on the quiz edit form; quick publish switches + amber "Draft" badges on the admin dashboard and the category tree.

## Newsletter

- Signed-in users only. Everyone is subscribed **by default**; they can opt out from their profile page.
- Table `newsletter_subscribers` — userId (Clerk id, PK), email, subscribed (boolean, default true), createdAt/updatedAt.
- Endpoints (auth required): `GET /api/newsletter/me` upserts the user's current Clerk email (preserving any prior opt-out) and returns `{ email, subscribed }`; `PATCH /api/newsletter/me { subscribed }` opts in/out. Email is always read server-side from Clerk (`clerkClient.users.getUser`), never trusted from the client. Clerk fetch failures return `502`.
- Default enrollment: a silent `NewsletterEnrollment` component in `App.tsx` (rendered only when signed-in) calls `GET /api/newsletter/me` on app bootstrap, so every signed-in user is captured even if they never open their profile.
- Admin: `GET /api/newsletter/subscribers` (admin-only via `requireAdmin`) returns the subscribed recipients plus `subscribedCount`/`optedOutCount`. Admin page `/admin/newsletter` shows counts, the subscriber table, and a CSV export. Linked from the admin dashboard.

## Contact

- Public contact form at `/contact` (linked in the footer). Fields: name, email, message, and an optional reason (Quiz correction / Quiz suggestion / Website feedback / Partnership / advertising / Other).
- Table `contact_messages` — id (serial PK), name, email, reason (nullable text), message, createdAt.
- Endpoints: `POST /api/contact` is **public** (no auth) and bounded (name ≤100, email ≤200, message ≤5000 chars; email format validated). It stores the message and returns `{ id }`. `GET /api/contact/messages` (admin-only via `requireAdmin`) returns `{ messages, total }` newest-first.
- Admin page `/admin/contact` (linked from the admin dashboard) lists submissions newest-first, each with a `mailto:` reply link.
- Email delivery is **deferred**: submissions are currently stored only (visible in the admin panel). Emailing each submission to worldgeographytrivia@gmail.com can be added later by connecting a transactional-email provider (e.g. Resend) and calling a send helper from the `POST /api/contact` handler (best-effort, must not fail the DB save).

## About

- Public, static About page at `/about` (linked in the footer next to Contact/Privacy). Static prose only — no DB, no form. Page component `src/pages/about.tsx` uses the same `usePageMeta` + container/Card layout as the Privacy page, with CTAs to browse quizzes (`/`) and the daily quiz (`/daily`).
- SEO/crawlability follows the Privacy pattern at all three meta chokepoints: prerender (`prerender.mjs` `aboutBody()` + `writeRoute("/about", …)`), production SSR (`api-server` `ssr-pages.ts` `GET /about`, served before the SPA catch-all), and the sitemap (static URL entry). The About copy lives verbatim in all three (`about.tsx`, `aboutBody()`, the SSR route) — keep them in sync if the text changes.

## Did You Know

- Public page at `/did-you-know` (linked from the home hero "Did you know?" button and the footer). Shows two sections: **Quick Facts** (short factoids, each with an optional source link) and **Articles** (blog-style long reads). Reads are public; writes are admin-only.
- Each article has its own page at `/did-you-know/:slug` rendered blog-style. Article bodies are Markdown.
- **Markdown**: `lib/markdown` (`@workspace/markdown`) is the single safe Markdown→HTML renderer shared by every render path (client `dangerouslySetInnerHTML`, production SSR, and prerender). Input is HTML-escaped first, then a fixed allow-list of tags is generated. Link hrefs are restricted to http(s)/relative; other schemes (javascript:, data:) fall back to plain text. `isSafeHttpUrl(url)` exports the same http(s)-only policy used for non-Markdown links.
- **Factoid `sourceUrl` safety**: a saved source URL is rendered as an `<a href>` on the public page, so it must never carry a `javascript:`/`data:` scheme. The server (`routes/factoids.ts`) normalizes on create/update — empty → `null`, non-http(s) → `400` — and the client + SSR + prerender all gate the anchor behind `isSafeHttpUrl`. Any new place that renders a stored URL as an href must apply the same check.
- **Admin** (`/admin/did-you-know`, linked from the admin dashboard): inline create/edit/delete + publish toggle for factoids; an article list with publish toggle, edit, and delete. Article create/edit live at `/admin/did-you-know/articles/new` and `/admin/did-you-know/articles/:id` (shared `ArticleForm` component); slug auto-generates from the title when blank.
- **Visibility**: both factoids and articles have a `published` flag (default draft). Non-admins see only published rows on the list and detail endpoints (draft article detail returns `404`); admins see all. The server is the security boundary; the client admin guard is UX only.
- **SEO/crawlability** mirrors the Privacy/About pattern at all three chokepoints: prerender (`prerender.mjs` `didYouKnowBody()` + `articleDetailBody()`), production SSR (`ssr-pages.ts`), and the **live** sitemap (`sitemap.ts` — `/did-you-know` plus a URL per published article). Per-article pages emit Article + BreadcrumbList JSON-LD.

## Database Schema

- `quizzes` — id, title, description, category (legacy text label), difficulty, published (boolean, default false), timestamps
- `questions` — id, quiz_id, text, options[], correct_option, explanation, fun_fact, image_url, order_index, timestamps
- `quiz_attempts` — id, quiz_id, user_id (nullable), score, total_questions, answers (jsonb), created_at
- `categories` — id, name, parent_id (self-ref, ON DELETE SET NULL), published (boolean, default false), timestamps. Forms an unlimited-depth tree.
- `quiz_categories` — composite PK (quiz_id, category_id), both ON DELETE CASCADE. Many-to-many join table; quizzes can belong to multiple categories.
- `question_categories` — composite PK (question_id, category_id), both ON DELETE CASCADE. Many-to-many join table; questions can be tagged with multiple categories and reused independently of their quiz.
- `factoids` — id, text, source_label (nullable), source_url (nullable, http(s) only), published (boolean, default false), timestamps. Short "Did You Know" facts.
- `articles` — id, title, slug (unique), summary (nullable), body (Markdown), image_url (nullable), published (boolean, default false), timestamps. Blog-style long reads for the "Did You Know" page.

## Category Hierarchy

Initial seeded structure:
- By Region → Africa, Antarctica, Europe, Middle East
- By Topic → Capitals, Physical Geography, Ancient Sites

Admin can create/rename/delete categories and reparent freely at `/admin/categories`. Quizzes are assigned via multi-select on the create/edit quiz forms. Home page sidebar filters quizzes by category (selecting a parent includes all descendants).

Each category also has a unique `slug` and a shareable landing page at `/category/{slug}` (e.g. `/category/europe`, `/category/by-region`). Slugs are auto-generated from the name on create (and de-duplicated with `-2`, `-3` suffixes). The landing page shows breadcrumbs (root → ... → current), a list of direct subcategories, all quizzes in this category or any descendant, and a Share button (uses Web Share API on supported devices, falls back to copying the URL to clipboard). Each category page sets its own `<title>`, `<meta description>`, and OpenGraph/Twitter tags for SEO and link previews.

The home page is a category browser only (no quizzes shown directly) — it groups child categories under each root section so the page stays clean as more quizzes are added. Users drill into a category to see its quizzes.

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (also runs automatically as the Railway pre-deploy command)
- `pnpm --filter @workspace/scripts run check-db-image-files` — maintenance check: flags DB image URLs (question/category/course `image_url`) under `/regions/` or `/landmarks/` whose source file or responsive variants are missing from `public/`. Needs `DATABASE_URL`; exits non-zero on missing files. Run against dev or prod. This check also runs automatically as a **pre-deploy gate**: it is the first step of the web service's build (see `railway.json`), running against the production database before the frontend/api-server builds. A failure fails the whole deploy build, so broken image references block publishing until fixed. It additionally runs on a **schedule** against production (see "Scheduled Broken-Image Check" below).

## Scheduled Broken-Image Check

The pre-deploy gate only catches broken image references at publish time. Admins add and edit image URLs through the live admin UI without redeploying, so a bad reference can sit in production until the next deploy. A **Railway cron service** runs the same `check-db-image-files` script on a regular cadence against the production database to catch these promptly.

- **What it runs:** the existing `pnpm --filter @workspace/scripts run check-db-image-files` script — no separate logic. It exits non-zero when any DB image URL points at a missing source file or responsive variant.
- **Why a fresh checkout is enough:** the responsive variants (`-400/-768/-1024.webp/.avif`) under `public/regions` and `public/landmarks` are committed to git, so the script needs no frontend build — only `pnpm install` to get `tsx` + workspace deps. It reads `DATABASE_URL` to inspect the live DB.
- **How failures reach the team:** a non-zero exit makes the scheduled run fail, which Railway surfaces in the service's deploy/run logs and observability alerts. Broken-image details are printed to the run logs (`source#id -> url` + the missing files).
- **Active alerting (optional):** when `BROKEN_IMAGE_ALERT_WEBHOOK_URL` is set, the script POSTs a JSON notification (Slack-compatible `text` summary plus a structured `broken` array of `{ source, id, url, reason }`) so the team is alerted without watching logs. Works with Slack incoming webhooks and generic JSON webhooks. Only genuinely broken images trigger an alert — transient failures (timeouts/DNS/5xx/429) never notify. The webhook is best-effort: when unconfigured it is a no-op, and a delivery failure is logged but never changes the run's exit code.

### One-time setup (in the Railway dashboard)

Create a **second service** from this same repo (alongside the web service):

- **Config path:** `railway.cron.json` (sets the start command, a daily `0 6 * * *` schedule, and no restarts)
- **Variables:** `DATABASE_URL` (reference the Postgres service), optionally `BROKEN_IMAGE_ALERT_WEBHOOK_URL`
- Adjust the `cronSchedule` in `railway.cron.json` to how often admins edit images.

## Environment Variables

- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth keys
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_USER_IDS` — comma-separated Clerk user IDs with admin access
- `VITE_CANONICAL_DOMAIN` — canonical origin for SEO/sitemap/SSR (`https://worldgeographytrivia.com` in production)
- `BROKEN_IMAGE_ALERT_WEBHOOK_URL` — optional webhook for broken-image alerts
- `TRUST_PROXY_HOPS` — number of reverse proxies in front of the server (default 1)

## Admin Access

- Admin write endpoints (`POST/PATCH/DELETE` on quizzes, questions, categories) and the `/admin/*` UI are restricted via the `requireAdmin` middleware. It rejects unauthenticated requests with `401` and signed-in non-admins with `403`.
- Admin identity is configured via the `ADMIN_USER_IDS` env var: a comma-separated list of Clerk user IDs. If unset/empty, no one is an admin (fail-closed).
- Set `ADMIN_USER_IDS` in your environment (Railway service variables in production, shell env or a local `.env` in development) so it's available in both development and the deployed app.
- Bootstrap UX: visit `/admin` while signed in but not yet an admin — the page displays your Clerk user ID so you can copy it into `ADMIN_USER_IDS`, then refresh.
- The client uses `GET /api/me` (`useGetMe`) to decide whether to show the Admin nav link and to gate `/admin/*` routes. The server is the security boundary; the client guard is UX only.

## Bulk Import

- Admin page at `/admin/import` lets admins paste or upload a JSON array of question objects.
- Endpoint: `POST /api/quizzes/bulk-import` (admin-only). Accepts either `{ items: BulkImportItem[], categoryIds?: number[] }` or a bare array of items.
- Items are grouped by their `topic` field. Each topic becomes (or maps to) a quiz with `title = topic`. New quizzes are created with `description = "A quiz on {topic}"`, `category = topic`, and `difficulty` = the most common value among that topic's questions (default `Medium`). Optional `categoryIds` are attached only to newly created quizzes.
- Question fields: `question`, `options{A,B,C,D}`, `correct_answer` ("A"|"B"|"C"|"D"), `explanation`, optional `fun_fact`, `difficulty`, `image_url`, `categories` (string[]). Letters map to options index 0–3.
- Per-item `categories` are resolved by name (case-insensitive). Names that don't match an existing category create a new root category (unique slug auto-generated). The matched/created category ids tag each imported question via `question_categories`. The response's `categoriesCreated` lists names of newly created categories.
- Order indices continue from `max(orderIndex) + 1` of the existing quiz, so re-importing the same topic appends questions.
- The whole import runs inside a single DB transaction — if any insert fails, no quizzes, questions, categories, or tags are created.

## Question Tagging

- Questions can be tagged with any categories from the tree (many-to-many via `question_categories`), independently of the curated quiz they belong to. One question can carry multiple tags and be reused across quizzes via import-by-tag.
- Admin: the create-question form and the quiz-edit page expose a category multi-select / "Edit tags" dialog. `POST /api/quizzes/:id/questions` and `PATCH /api/questions/:id` accept `categoryIds: number[]` (replaces the full tag set). Question GET/list responses include `categories: QuestionCategory[]` ({ id, name, slug }).
- `GET /api/categories/tree` returns a descendant-inclusive, de-duplicated `taggedQuestionCount` per node, used by the admin import-by-tag pickers to show how many questions a category (or any descendant) contributes.

## Seeded Data

4 quizzes with 8-9 questions each:
1. World Capitals (Medium, 9 questions)
2. European Geography (Hard, 8 questions)
3. Oceans & Seas (Easy, 7 questions)
4. African Nations (Medium, 8 questions)
