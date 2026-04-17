# Workspace

## Overview

Geography Quiz platform — a full-stack React + Express web application where visitors can take geography quizzes and admins can manage quiz content.

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

## Architecture

- `artifacts/geo-quiz` — React frontend (quiz-taking UI + admin panel)
- `artifacts/api-server` — Express backend API
- `lib/db` — Drizzle ORM schema (quizzes, questions, quiz_attempts tables)
- `lib/api-spec` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas

## Features

### Public
- Browse available geography quizzes
- Take a quiz (one question at a time with multiple choice)
- After each answer: see if correct, read explanation + fun fact
- Final score and detailed results breakdown

### Admin (/admin)
- View all quizzes with question counts
- Create, edit, delete quizzes
- Add, edit, delete questions for each quiz
- Each question has: text, 4 options, correct answer, explanation, fun fact, optional image

## Database Schema

- `quizzes` — id, title, description, category, difficulty, created_at, updated_at
- `questions` — id, quiz_id, text, options (array), correct_option, explanation, fun_fact, image_url, order_index, timestamps
- `quiz_attempts` — id, quiz_id, score, total_questions, answers (jsonb), created_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Seeded Data

4 quizzes with 8-9 questions each:
1. World Capitals (Medium, 9 questions)
2. European Geography (Hard, 8 questions)
3. Oceans & Seas (Easy, 7 questions)
4. African Nations (Medium, 8 questions)
