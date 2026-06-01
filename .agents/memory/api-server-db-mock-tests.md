---
name: api-server test db-mock queue
description: How the api-server vitest db mock works and the FIFO gotcha when testing handlers with many sequential db calls
---

# api-server db-mock (vitest)

`@workspace/db` is mocked in `src/test/setup.ts`; `src/test/db-mock.ts` exposes a chainable `db`
whose every awaited call (`select/insert/update/delete/.returning()/.limit()` etc.) resolves by
**shifting one result off a shared FIFO queue** (`pushDbResult(...)`, `resetDbQueue()` in `beforeEach`).

**Gotcha — one queue entry per awaited db call, in exact order.** This includes calls whose result the
handler ignores (e.g. `delete` of old links, link `insert` without `.returning()`). If you push only the
"interesting" results, an ignored `await` will eat the next entry and the assertions go sideways. Push `[]`
placeholders for ignored calls to keep alignment. To trace order, read the handler top-to-bottom and count
every `await db.*` (including ones inside helpers like `setQuestionCategories` and `uniqueSlugWith`, and the
slug-conflict `select` loop).

**Transactions:** `dbMock.transaction(fn)` just calls `fn(dbMock)`, so a `tx` inside a transaction draws from
the same queue as `db` — count those awaits too.

**Auth in tests:** clerk is mocked to read `x-test-user-id` header; admin is whoever matches
`process.env.ADMIN_USER_IDS` (set it in the test module, restore in `afterAll`).

**Adding a field to a serialized response** breaks any `expect(res.body).toEqual({...})` exact-match tests
(e.g. in `adminWrites.test.ts`) — update those expectations in lockstep.
