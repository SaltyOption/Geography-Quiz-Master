import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "../routes";
import { resetDbQueue, pushDbResult, recordedInserts } from "../test/db-mock";

const ADMIN_ID = "user_admin_123";
const NON_ADMIN_ID = "user_random_456";

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

const dateNow = new Date("2026-01-01T00:00:00.000Z");

const validBody = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "The daily quiz for Oceania has a wrong answer.",
  reason: "Quiz correction",
};

describe("POST /api/contact", () => {
  it("returns 400 for a body that fails validation", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ name: "Ada", email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when fields are whitespace-only after trimming", async () => {
    // Signed-in so the failed attempt cannot consume the shared anonymous
    // rate-limit bucket used by the tests below.
    const res = await request(app)
      .post("/api/contact")
      .set("x-test-user-id", "user_trim_test")
      .send({ ...validBody, name: "   " });
    expect(res.status).toBe(400);
  });

  it("stores a valid submission and returns its id", async () => {
    pushDbResult([{ id: 7, ...validBody, createdAt: dateNow }]);
    const res = await request(app)
      .post("/api/contact")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ ...validBody, name: "  Ada Lovelace  " });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 7 });
    // Trimmed values are what get written.
    expect(recordedInserts).toEqual([
      {
        name: "Ada Lovelace",
        email: "ada@example.com",
        reason: "Quiz correction",
        message: validBody.message,
      },
    ]);
  });

  describe("rate limiting", () => {
    it("allows 5 anonymous submissions per window, then returns 429", async () => {
      for (let i = 1; i <= 5; i++) {
        pushDbResult([{ id: i, ...validBody, createdAt: dateNow }]);
        const res = await request(app).post("/api/contact").send(validBody);
        expect(res.status).toBe(201);
      }
      const blocked = await request(app).post("/api/contact").send(validBody);
      expect(blocked.status).toBe(429);
    });

    it("ignores client-supplied X-Forwarded-For when bucketing", async () => {
      // The limiter keys off req.ip (resolved via `trust proxy`), so a
      // spoofed header must not mint a fresh bucket once the caller's real
      // address is exhausted.
      const res = await request(app)
        .post("/api/contact")
        .set("X-Forwarded-For", "203.0.113.99")
        .send(validBody);
      expect(res.status).toBe(429);
    });

    it("buckets signed-in users separately from anonymous traffic", async () => {
      pushDbResult([{ id: 42, ...validBody, createdAt: dateNow }]);
      const res = await request(app)
        .post("/api/contact")
        .set("x-test-user-id", "user_separate_bucket")
        .send(validBody);
      expect(res.status).toBe(201);
    });
  });
});

describe("GET /api/contact/messages", () => {
  it("returns 401 when signed out", async () => {
    const res = await request(app).get("/api/contact/messages");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a signed-in non-admin", async () => {
    const res = await request(app)
      .get("/api/contact/messages")
      .set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(403);
  });

  it("returns messages newest-first with a total for admins", async () => {
    pushDbResult([
      {
        id: 2,
        name: "Grace",
        email: "grace@example.com",
        reason: null,
        message: "Love the site",
        createdAt: dateNow,
      },
    ]);
    const res = await request(app)
      .get("/api/contact/messages")
      .set("x-test-user-id", ADMIN_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      messages: [
        {
          id: 2,
          name: "Grace",
          email: "grace@example.com",
          reason: null,
          message: "Love the site",
          createdAt: dateNow.toISOString(),
        },
      ],
      total: 1,
    });
  });
});
