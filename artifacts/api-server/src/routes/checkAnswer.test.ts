import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const ADMIN_ID = "user_check_answer_admin";
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

function quizRow(overrides: Record<string, unknown> = {}) {
  return { id: 1, published: true, ...overrides };
}

function questionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    quizId: 1,
    text: "Capital of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Perth"],
    correctOption: 2,
    explanation: "Canberra is the capital.",
    funFact: "It was purpose-built as the capital.",
    imageUrl: null,
    orderIndex: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("POST /api/quizzes/:id/questions/:questionId/check", () => {
  it("reveals the answer key for a correct selection on a published quiz", async () => {
    pushDbResult([quizRow()], [questionRow()]);
    const res = await request(app)
      .post("/api/quizzes/1/questions/10/check")
      .send({ selectedOption: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      questionId: 10,
      selectedOption: 2,
      correctOption: 2,
      isCorrect: true,
      explanation: "Canberra is the capital.",
      funFact: "It was purpose-built as the capital.",
    });
  });

  it("marks an incorrect selection while still revealing the answer key", async () => {
    pushDbResult([quizRow()], [questionRow()]);
    const res = await request(app)
      .post("/api/quizzes/1/questions/10/check")
      .send({ selectedOption: 0 });
    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.correctOption).toBe(2);
  });

  it("returns null funFact when the question has none", async () => {
    pushDbResult([quizRow()], [questionRow({ funFact: null })]);
    const res = await request(app)
      .post("/api/quizzes/1/questions/10/check")
      .send({ selectedOption: 2 });
    expect(res.status).toBe(200);
    expect(res.body.funFact).toBeNull();
  });

  it("hides draft quizzes from non-admin callers (404)", async () => {
    pushDbResult([quizRow({ published: false })]);
    const res = await request(app)
      .post("/api/quizzes/1/questions/10/check")
      .send({ selectedOption: 2 });
    expect(res.status).toBe(404);
  });

  it("lets an admin check answers on a draft quiz", async () => {
    pushDbResult([quizRow({ published: false })], [questionRow()]);
    const res = await request(app)
      .post("/api/quizzes/1/questions/10/check")
      .set("x-test-user-id", ADMIN_ID)
      .send({ selectedOption: 2 });
    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
  });

  it("returns 404 when the question belongs to a different quiz", async () => {
    pushDbResult([quizRow({ id: 1 })], [questionRow({ quizId: 2 })]);
    const res = await request(app)
      .post("/api/quizzes/1/questions/10/check")
      .send({ selectedOption: 2 });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent quiz", async () => {
    pushDbResult([]);
    const res = await request(app)
      .post("/api/quizzes/999/questions/10/check")
      .send({ selectedOption: 2 });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent question", async () => {
    pushDbResult([quizRow()], []);
    const res = await request(app)
      .post("/api/quizzes/1/questions/999/check")
      .send({ selectedOption: 2 });
    expect(res.status).toBe(404);
  });

  it("rejects a missing selectedOption with 400", async () => {
    const res = await request(app)
      .post("/api/quizzes/1/questions/10/check")
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range selectedOption with 400", async () => {
    const res = await request(app)
      .post("/api/quizzes/1/questions/10/check")
      .send({ selectedOption: 5 });
    expect(res.status).toBe(400);
  });
});
