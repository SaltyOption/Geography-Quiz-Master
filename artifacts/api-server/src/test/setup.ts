import { vi } from "vitest";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

vi.mock("@workspace/db", async () => {
  const schema = await vi.importActual<Record<string, unknown>>(
    "@workspace/db/schema",
  );
  const { dbMock } = await import("./db-mock");
  return {
    ...schema,
    db: dbMock,
    pool: { end: () => Promise.resolve() },
  };
});

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (
      req: {
        headers: Record<string, string>;
        auth?: { userId: string | null };
      },
      _res: unknown,
      next: () => void,
    ): void => {
      const userIdHeader = req.headers["x-test-user-id"];
      req.auth = {
        userId:
          typeof userIdHeader === "string" && userIdHeader.length > 0
            ? userIdHeader
            : null,
      };
      next();
    },
  getAuth: (req: { auth?: { userId: string | null } }) =>
    req.auth ?? { userId: null },
}));
