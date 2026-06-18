---
name: Quiz-detail embedded categories have no slug
description: The quiz-detail API embeds categories WITHOUT a slug field; match/detect by name, not slug, on the quiz page.
---

The quiz-detail endpoint (`GET /api/quizzes/:id`, consumed by `useGetQuiz`) embeds
each category as `{ id, name, parentId, published, createdAt, updatedAt }` — there
is **no `slug`** on these embedded objects (confirmed via
`curl /api/quizzes/<id>`).

**Why it bites:** the quiz page's category chips and breadcrumb reference
`cat.slug` as if it exists, so any new code that reads `cat.slug` on quiz-detail
categories gets `undefined`. Calling a method on it (e.g. `c.slug.toLowerCase()`)
throws a runtime "Cannot read properties of undefined" and white-screens the
`<QuizPage>`.

**How to apply:** when detecting/branching on a quiz's category from the
quiz-detail response (e.g. "is this a World Cup quiz?"), match on `c.name`
(guard with `c.name ?? ""`), NOT on slug. If you genuinely need a slug there,
fetch it from the category tree / category endpoints instead of assuming the
embedded object carries one.
