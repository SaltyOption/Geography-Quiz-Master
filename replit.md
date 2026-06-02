# Workspace

## Overview

World Geography Trivia — a full-stack geography quiz platform. Visitors can take geography quizzes and track their progress. Admins can manage quiz content. Users can create accounts to save their history.

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

## Architecture

- `artifacts/geo-quiz` — React frontend (quiz UI + admin panel + auth)
- `artifacts/api-server` — Express backend API (with Clerk middleware)
- `lib/db` — Drizzle ORM schema (quizzes, questions, quiz_attempts tables)
- `lib/api-spec` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas

## Features

### Public (no account required)
- Browse geography quizzes by category and difficulty
- Take any quiz — one question at a time with multiple choice
- After each answer: feedback, explanation, fun fact
- Final score and question-by-question results

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

## Newsletter

- Signed-in users only. Everyone is subscribed **by default**; they can opt out from their profile page.
- Table `newsletter_subscribers` — userId (Clerk id, PK), email, subscribed (boolean, default true), createdAt/updatedAt.
- Endpoints (auth required): `GET /api/newsletter/me` upserts the user's current Clerk email (preserving any prior opt-out) and returns `{ email, subscribed }`; `PATCH /api/newsletter/me { subscribed }` opts in/out. Email is always read server-side from Clerk (`clerkClient.users.getUser`), never trusted from the client. Clerk fetch failures return `502`.
- Default enrollment: a silent `NewsletterEnrollment` component in `App.tsx` (rendered only when signed-in) calls `GET /api/newsletter/me` on app bootstrap, so every signed-in user is captured even if they never open their profile.
- Admin: `GET /api/newsletter/subscribers` (admin-only via `requireAdmin`) returns the subscribed recipients plus `subscribedCount`/`optedOutCount`. Admin page `/admin/newsletter` shows counts, the subscriber table, and a CSV export. Linked from the admin dashboard.

## Database Schema

- `quizzes` — id, title, description, category (legacy text label), difficulty, timestamps
- `questions` — id, quiz_id, text, options[], correct_option, explanation, fun_fact, image_url, order_index, timestamps
- `quiz_attempts` — id, quiz_id, user_id (nullable), score, total_questions, answers (jsonb), created_at
- `categories` — id, name, parent_id (self-ref, ON DELETE SET NULL), timestamps. Forms an unlimited-depth tree.
- `quiz_categories` — composite PK (quiz_id, category_id), both ON DELETE CASCADE. Many-to-many join table; quizzes can belong to multiple categories.
- `question_categories` — composite PK (question_id, category_id), both ON DELETE CASCADE. Many-to-many join table; questions can be tagged with multiple categories and reused independently of their quiz.

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
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Environment Variables (Auto-Provisioned)

- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth keys
- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — PostgreSQL

## Admin Access

- Admin write endpoints (`POST/PATCH/DELETE` on quizzes, questions, categories) and the `/admin/*` UI are restricted via the `requireAdmin` middleware. It rejects unauthenticated requests with `401` and signed-in non-admins with `403`.
- Admin identity is configured via the `ADMIN_USER_IDS` env var: a comma-separated list of Clerk user IDs. If unset/empty, no one is an admin (fail-closed).
- Set `ADMIN_USER_IDS` in the workspace Secrets pane so it's available in both development and the deployed app.
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
