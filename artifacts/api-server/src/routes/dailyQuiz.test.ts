import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import router from "./index";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const app = express();
app.use(express.json());
app.use("/api", router);

beforeEach(() => {
  resetDbQueue();
});

describe("GET /api/daily-quiz", () => {
  it("returns a quizId and date when quizzes exist", async () => {
    pushDbResult([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const res = await request(app).get("/api/daily-quiz");
    expect(res.status).toBe(200);
    expect(typeof res.body.quizId).toBe("number");
    expect([1, 2, 3]).toContain(res.body.quizId);
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is deterministic across calls on the same day", async () => {
    pushDbResult([{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }, { id: 50 }]);
    const a = await request(app).get("/api/daily-quiz");
    pushDbResult([{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }, { id: 50 }]);
    const b = await request(app).get("/api/daily-quiz");
    expect(a.body.quizId).toBe(b.body.quizId);
    expect(a.body.date).toBe(b.body.date);
  });

  it("returns 404 when there are no quizzes", async () => {
    pushDbResult([]);
    const res = await request(app).get("/api/daily-quiz");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("No quizzes available");
  });
});
