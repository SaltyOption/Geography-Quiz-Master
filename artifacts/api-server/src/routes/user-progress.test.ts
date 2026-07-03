import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "../routes";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const ADMIN_ID = "user_admin_123";
const USER_ID = "user_random_456";

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

const attemptRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  quizId: 10,
  quizTitle: "Capitals of Europe",
  score: 9,
  totalQuestions: 10,
  completedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...over,
});

describe("GET /api/user/progress", () => {
  it("returns 401 when signed out", async () => {
    const res = await request(app).get("/api/user/progress");
    expect(res.status).toBe(401);
  });

  it("returns aggregate stats plus mapped recent attempts", async () => {
    // Queue order matches the route's queries: aggregate row, then the
    // recent-attempts page.
    pushDbResult(
      [
        {
          totalAttempts: 3,
          totalQuizzesTaken: 2,
          averagePercentage: 76.7,
          bestPercentage: 90,
        },
      ],
      [
        attemptRow(),
        attemptRow({
          id: 2,
          quizId: 11,
          quizTitle: "Rivers",
          score: 0,
          totalQuestions: 0,
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
    );
    const res = await request(app)
      .get("/api/user/progress")
      .set("x-test-user-id", USER_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalAttempts: 3,
      totalQuizzesTaken: 2,
      averagePercentage: 76.7,
      bestPercentage: 90,
      recentAttempts: [
        {
          id: 1,
          quizId: 10,
          quizTitle: "Capitals of Europe",
          score: 9,
          totalQuestions: 10,
          percentage: 90,
          completedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: 2,
          quizId: 11,
          quizTitle: "Rivers",
          score: 0,
          totalQuestions: 0,
          percentage: 0,
          completedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns zeroed stats for a user with no visible attempts", async () => {
    pushDbResult(
      [
        {
          totalAttempts: 0,
          totalQuizzesTaken: 0,
          averagePercentage: 0,
          bestPercentage: 0,
        },
      ],
      [],
    );
    const res = await request(app)
      .get("/api/user/progress")
      .set("x-test-user-id", USER_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalAttempts: 0,
      totalQuizzesTaken: 0,
      averagePercentage: 0,
      bestPercentage: 0,
      recentAttempts: [],
    });
  });
});

describe("GET /api/user/progress/:quizId", () => {
  it("returns 401 when signed out", async () => {
    const res = await request(app).get("/api/user/progress/10");
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-numeric quiz id", async () => {
    const res = await request(app)
      .get("/api/user/progress/abc")
      .set("x-test-user-id", USER_ID);
    expect(res.status).toBe(400);
  });

  it("computes best score, best percentage, and history", async () => {
    pushDbResult([
      attemptRow({ id: 3, score: 7, completedAt: new Date("2026-01-03T00:00:00.000Z") }),
      attemptRow({ id: 2, score: 9, completedAt: new Date("2026-01-02T00:00:00.000Z") }),
    ]);
    const res = await request(app)
      .get("/api/user/progress/10")
      .set("x-test-user-id", USER_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      quizId: 10,
      attempts: 2,
      bestScore: 9,
      bestPercentage: 90,
      lastAttemptAt: "2026-01-03T00:00:00.000Z",
      history: [
        {
          id: 3,
          quizId: 10,
          quizTitle: "Capitals of Europe",
          score: 7,
          totalQuestions: 10,
          percentage: 70,
          completedAt: "2026-01-03T00:00:00.000Z",
        },
        {
          id: 2,
          quizId: 10,
          quizTitle: "Capitals of Europe",
          score: 9,
          totalQuestions: 10,
          percentage: 90,
          completedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns an empty history when the user has no attempts on the quiz", async () => {
    pushDbResult([]);
    const res = await request(app)
      .get("/api/user/progress/10")
      .set("x-test-user-id", USER_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      quizId: 10,
      attempts: 0,
      bestScore: 0,
      bestPercentage: 0,
      lastAttemptAt: null,
      history: [],
    });
  });
});
