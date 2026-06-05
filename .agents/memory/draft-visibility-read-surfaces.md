---
name: Draft/published visibility — all read surfaces
description: A published/draft flag must be enforced on every read path that exposes the content, including indirect and aggregate ones, not just list/detail.
---

When a content type gets a `published`/draft flag whose drafts must be hidden from
non-admins, the server is the security boundary and enforcement must cover EVERY
path that can disclose the content or its existence — not just the obvious
list/detail endpoints.

**Why:** Iterative review repeatedly surfaced leaks beyond the primary endpoints:
direct-by-id question reads, ancestor-aware category pages, category chips on
quizzes, question category tags, attempt scoring (returned correctOption/
explanation), the user's own attempt history (quiz title metadata), and even
aggregate counts (`taggedQuestionCount`, `quizCount`) that leak draft *volume*.

**How to apply:** When adding/auditing a visibility flag, sweep these surface
classes for non-admins:
- Primary list + detail (filter / 404).
- Direct-by-id sibling resources (e.g. a question whose parent is a draft) — look
  up the parent and 404.
- Hierarchical visibility: a child is visible only if it AND every ancestor is
  published. Centralize this (see `lib/categoryVisibility.ts`,
  `isCategoryVisible`/`getVisibleCategoryIds`) and reuse it for pages, chips, and
  embedded references — do not re-derive `published`-only checks per call site.
- Cross-references / tags / chips that embed the gated entity elsewhere.
- Write/scoring endpoints that return gated content as a side effect
  (`POST /quiz-attempts` returned answers — gate the quiz AND scope scorable rows
  to that quiz to block cross-id injection).
- The owner's own history (attempts) — still filter drafts for non-admins.
- Aggregate counts — join through to the gated parent so draft rows don't inflate
  or merely reveal counts.
- Special endpoints that should exclude drafts for EVERYONE (e.g. daily quiz must
  match what visitors can actually play).
