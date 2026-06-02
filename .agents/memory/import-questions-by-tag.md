---
name: Import questions by tag (copy semantics)
description: How the admin "import questions by tag" feature dedups and why it's best-effort, not a hard guarantee.
---

# Import questions by tag

Admin endpoint `POST /quizzes/{id}/questions/import-by-category` copies every
question tagged with a chosen category OR any descendant into the target quiz as
NEW independent rows (questions are 1:quiz via `questions.quiz_id NOT NULL`, so
sharing is impossible — copying is the only model). Copies retain their source
tags.

## Decision: duplicate skipping is best-effort, by exact `text`
The handler skips source questions whose `text` already exists in the target
quiz (and any whose `quizId` already equals the target). This is computed in app
code before the insert — there is intentionally **no** DB unique constraint on
`(quiz_id, text)`.

**Why:** A unique constraint would forbid legitimately duplicate-worded
questions and require a migration/behavior change beyond the feature's scope. The
dedup exists to make manual re-runs of the import idempotent for a single admin,
not to be a concurrency-safe integrity guarantee.

**How to apply:** Don't "fix" the known race (two concurrent imports to the same
quiz can both insert the same text) by silently adding a unique index — that
changes data rules. If true idempotency is ever required, raise it as an explicit
decision with the user first.
