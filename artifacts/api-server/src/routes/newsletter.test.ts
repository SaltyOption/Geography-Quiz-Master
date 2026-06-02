import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "../routes";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

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

describe("GET /api/newsletter/me", () => {
  it("returns 401 when not signed in", async () => {
    const res = await request(app).get("/api/newsletter/me");
    expect(res.status).toBe(401);
  });

  it("returns the user's email and subscribed status (default subscribed)", async () => {
    pushDbResult([
      {
        userId: NON_ADMIN_ID,
        email: `${NON_ADMIN_ID}@example.com`,
        subscribed: true,
        createdAt: dateNow,
        updatedAt: dateNow,
      },
    ]);
    const res = await request(app)
      .get("/api/newsletter/me")
      .set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      email: `${NON_ADMIN_ID}@example.com`,
      subscribed: true,
    });
  });
});

describe("PATCH /api/newsletter/me", () => {
  it("returns 401 when not signed in", async () => {
    const res = await request(app)
      .patch("/api/newsletter/me")
      .send({ subscribed: false });
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await request(app)
      .patch("/api/newsletter/me")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ subscribed: "nope" });
    expect(res.status).toBe(400);
  });

  it("opts the user out", async () => {
    pushDbResult([
      {
        userId: NON_ADMIN_ID,
        email: `${NON_ADMIN_ID}@example.com`,
        subscribed: false,
        createdAt: dateNow,
        updatedAt: dateNow,
      },
    ]);
    const res = await request(app)
      .patch("/api/newsletter/me")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ subscribed: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      email: `${NON_ADMIN_ID}@example.com`,
      subscribed: false,
    });
  });
});

describe("GET /api/newsletter/subscribers", () => {
  it("returns 401 when not signed in", async () => {
    const res = await request(app).get("/api/newsletter/subscribers");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a signed-in non-admin", async () => {
    const res = await request(app)
      .get("/api/newsletter/subscribers")
      .set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(403);
  });

  it("returns subscribed recipients and counts for an admin", async () => {
    pushDbResult([
      { userId: "u1", email: "a@example.com", subscribed: true, createdAt: dateNow, updatedAt: dateNow },
      { userId: "u2", email: "b@example.com", subscribed: false, createdAt: dateNow, updatedAt: dateNow },
      { userId: "u3", email: "c@example.com", subscribed: true, createdAt: dateNow, updatedAt: dateNow },
    ]);
    const res = await request(app)
      .get("/api/newsletter/subscribers")
      .set("x-test-user-id", ADMIN_ID);
    expect(res.status).toBe(200);
    expect(res.body.subscribedCount).toBe(2);
    expect(res.body.optedOutCount).toBe(1);
    expect(res.body.subscribers).toEqual([
      { email: "a@example.com", createdAt: dateNow.toISOString() },
      { email: "c@example.com", createdAt: dateNow.toISOString() },
    ]);
  });
});
