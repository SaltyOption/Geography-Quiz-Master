# Workspace

## Overview

AtlasQuest — a full-stack geography quiz platform. Visitors can take geography quizzes and track their progress. Admins can manage quiz content. Users can create accounts to save their history.

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

## Database Schema

- `quizzes` — id, title, description, category, difficulty, timestamps
- `questions` — id, quiz_id, text, options[], correct_option, explanation, fun_fact, image_url, order_index, timestamps
- `quiz_attempts` — id, quiz_id, user_id (nullable), score, total_questions, answers (jsonb), created_at

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Environment Variables (Auto-Provisioned)

- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth keys
- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — PostgreSQL

## Seeded Data

4 quizzes with 8-9 questions each:
1. World Capitals (Medium, 9 questions)
2. European Geography (Hard, 8 questions)
3. Oceans & Seas (Easy, 7 questions)
4. African Nations (Medium, 8 questions)
