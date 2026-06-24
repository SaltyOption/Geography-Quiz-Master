import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult, recordedInserts, recordedUpdates } from "../test/db-mock";

const ADMIN_ID = "user_factoid_admin";
const ORIGINAL_ADMIN_IDS = process.env.ADMIN_USER_IDS;
process.env.ADMIN_USER_IDS = ADMIN_ID;

const app = express();
app.use(express.json());
app.use(clerkMiddleware());
app.use("/api", router);

afterAll(() => {
  if (ORIGINAL_ADMIN_IDS === undefined) {
    delete process.env.ADMIN_USER_IDS;
  } else {
    process.env.ADMIN_USER_IDS = ORIGINAL_ADMIN_IDS;
  }
});

beforeEach(() => {
  resetDbQueue();
});

const now = new Date("2026-01-01T00:00:00.000Z");

function factoidRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    text: "The Sahara is larger than the contiguous US.",
    sourceLabel: null,
    sourceUrl: null,
    published: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const asAdmin = (req: request.Test) => req.set("x-test-user-id", ADMIN_ID);

describe("POST /api/factoids sourceUrl validation", () => {
  it("rejects a javascript: source URL with 400 and never writes", async () => {
    const res = await asAdmin(
      request(app)
        .post("/api/factoids")
        .send({ text: "Fact", sourceUrl: "javascript:alert(1)" }),
    );
    expect(res.status).toBe(400);
    expect(recordedInserts).toHaveLength(0);
  });

  it("rejects other non-http schemes (data:) with 400", async () => {
    const res = await asAdmin(
      request(app)
        .post("/api/factoids")
        .send({ text: "Fact", sourceUrl: "data:text/html,<script>1</script>" }),
    );
    expect(res.status).toBe(400);
    expect(recordedInserts).toHaveLength(0);
  });

  it("accepts and stores an https source URL", async () => {
    pushDbResult([factoidRow({ sourceUrl: "https://example.com/a" })]);
    const res = await asAdmin(
      request(app)
        .post("/api/factoids")
        .send({ text: "Fact", sourceUrl: "https://example.com/a" }),
    );
    expect(res.status).toBe(201);
    expect(recordedInserts).toHaveLength(1);
    expect(recordedInserts[0]).toMatchObject({ sourceUrl: "https://example.com/a" });
  });

  it("stores an empty source URL as null", async () => {
    pushDbResult([factoidRow()]);
    const res = await asAdmin(
      request(app).post("/api/factoids").send({ text: "Fact", sourceUrl: "   " }),
    );
    expect(res.status).toBe(201);
    expect(recordedInserts[0]).toMatchObject({ sourceUrl: null });
  });
});

describe("PATCH /api/factoids/:id sourceUrl validation", () => {
  it("rejects a javascript: source URL with 400 and never writes", async () => {
    const res = await asAdmin(
      request(app)
        .patch("/api/factoids/1")
        .send({ sourceUrl: "javascript:alert(1)" }),
    );
    expect(res.status).toBe(400);
    expect(recordedUpdates).toHaveLength(0);
  });

  it("accepts and stores an https source URL", async () => {
    pushDbResult([factoidRow({ sourceUrl: "https://example.com/b" })]);
    const res = await asAdmin(
      request(app)
        .patch("/api/factoids/1")
        .send({ sourceUrl: "https://example.com/b" }),
    );
    expect(res.status).toBe(200);
    expect(recordedUpdates[0]).toMatchObject({ sourceUrl: "https://example.com/b" });
  });
});
