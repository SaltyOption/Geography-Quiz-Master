---
name: api-server test harness
description: How the api-server vitest harness mocks @workspace/db and @clerk/express, and what a new route that needs Clerk user data must add.
---

# api-server test harness

The vitest harness (`artifacts/api-server/src/test/setup.ts`) global-mocks two modules:

- `@workspace/db` → a FIFO queue-backed `dbMock` (`src/test/db-mock.ts`). Tests call `pushDbResult(...)` in the same order the route awaits queries; every chain method is a passthrough and `await` shifts the next queued value (default `[]`). `onConflictDoUpdate`/`returning` are passthroughs, so an upsert+returning returns whatever you push next.
- `@clerk/express` → mocks `clerkMiddleware` (reads `x-test-user-id` header), `getAuth`, and `clerkClient`.

**Rule:** if a new route calls a Clerk SDK method, the mock must expose it.
`clerkClient.users.getUser` is mocked to return an email derived from the userId (`${userId}@example.com`). Any other `clerkClient` method you call from a route must be added to this mock or the test will throw at runtime.

**Why:** the mock is hand-written, not auto-generated — it only contains what existing routes use. A route calling an unmocked Clerk method passes typecheck but crashes the test.

**How to apply:** when adding a route that reads Clerk user data (email, metadata, etc.), extend the `clerkClient` object in `setup.ts`, and read the user's email server-side from Clerk rather than trusting the client.
