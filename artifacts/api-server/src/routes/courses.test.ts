import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const ADMIN_ID = "user_courses_admin_999";
const NON_ADMIN_ID = "user_courses_normal_888";
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

const minimalImportItem = {
  topic: "World Deserts",
  module: "Module 1: Intro",
  lesson: "Lesson 1",
  question: "What is the largest hot desert?",
  options: { A: "Sahara", B: "Gobi", C: "Atacama", D: "Kalahari" },
  correct_answer: "A",
  explanation: "The Sahara covers about 9 million sq km.",
};

describe("POST /api/courses/bulk-import", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .send({ items: [minimalImportItem] });
    expect(res.status).toBe(401);
  });

  it("rejects non-admin users with 403", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ items: [minimalImportItem] });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body shape (missing items)", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when items array is empty", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when items contain multiple topics", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        items: [
          minimalImportItem,
          { ...minimalImportItem, topic: "Other Topic" },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/single topic/i);
  });

  it("rejects items with bad correct_answer", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [{ ...minimalImportItem, correct_answer: "Z" }] });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/course-modules/:moduleId/attempts", () => {
  it("returns 400 for non-numeric moduleId", async () => {
    const res = await request(app)
      .post("/api/course-modules/abc/attempts")
      .send({ answers: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid body (missing answers)", async () => {
    const res = await request(app)
      .post("/api/course-modules/1/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 for anonymous users", async () => {
    const res = await request(app)
      .post("/api/course-modules/1/attempts")
      .send({ answers: [] });
    expect(res.status).toBe(401);
  });

  it("returns 404 when module does not exist", async () => {
    pushDbResult([]); // module lookup
    const res = await request(app)
      .post("/api/course-modules/9999/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ answers: [] });
    expect(res.status).toBe(404);
  });

  it("scores signed-in attempts and reports mastery threshold", async () => {
    // module lookup
    pushDbResult([{ id: 5, courseId: 1, slug: "m1", title: "M1", orderIndex: 0 }]);
    // lessons
    pushDbResult([{ id: 10 }]);
    // questions
    pushDbResult([
      {
        id: 100,
        lessonId: 10,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 101,
        lessonId: 10,
        text: "Q2",
        options: ["a", "b", "c", "d"],
        correctOption: 1,
        explanation: "ex",
        funFact: null,
      },
    ]);

    const res = await request(app)
      .post("/api/course-modules/5/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        answers: [
          { questionId: 100, selectedOption: 0 },
          { questionId: 101, selectedOption: 0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.totalQuestions).toBe(2);
    expect(res.body.percentage).toBe(50);
    expect(res.body.mastered).toBe(false);
    expect(res.body.masteryThreshold).toBe(80);
    expect(Array.isArray(res.body.questionResults)).toBe(true);
    expect(res.body.questionResults).toHaveLength(2);
  });

  it("marks attempt mastered when percentage >= 80", async () => {
    pushDbResult([{ id: 7, courseId: 1, slug: "m2", title: "M2", orderIndex: 1 }]);
    pushDbResult([{ id: 20 }]);
    pushDbResult([
      {
        id: 200,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 201,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 1,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 202,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 2,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 203,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 3,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 204,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "ex",
        funFact: null,
      },
    ]);

    const res = await request(app)
      .post("/api/course-modules/7/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        answers: [
          { questionId: 200, selectedOption: 0 },
          { questionId: 201, selectedOption: 1 },
          { questionId: 202, selectedOption: 2 },
          { questionId: 203, selectedOption: 3 },
          { questionId: 204, selectedOption: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(4);
    expect(res.body.percentage).toBe(80);
    expect(res.body.mastered).toBe(true);
  });
});

describe("POST /api/course-modules/:moduleId/attempts — bypass protection", () => {
  it("ignores duplicate answers for the same question", async () => {
    pushDbResult([{ id: 8, courseId: 1, slug: "m3", title: "M3", orderIndex: 2 }]);
    pushDbResult([{ id: 30 }]);
    pushDbResult([
      { id: 300, lessonId: 30, text: "Q", options: ["a", "b", "c", "d"], correctOption: 0, explanation: "ex", funFact: null },
      { id: 301, lessonId: 30, text: "Q", options: ["a", "b", "c", "d"], correctOption: 1, explanation: "ex", funFact: null },
      { id: 302, lessonId: 30, text: "Q", options: ["a", "b", "c", "d"], correctOption: 2, explanation: "ex", funFact: null },
    ]);

    // Submitting the SAME correct answer 5 times for question 300 should NOT
    // give the user 5/5 — duplicates are deduped, unanswered questions count wrong.
    const res = await request(app)
      .post("/api/course-modules/8/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        answers: [
          { questionId: 300, selectedOption: 0 },
          { questionId: 300, selectedOption: 0 },
          { questionId: 300, selectedOption: 0 },
          { questionId: 300, selectedOption: 0 },
          { questionId: 300, selectedOption: 0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.totalQuestions).toBe(3);
    expect(res.body.score).toBe(1);
    expect(res.body.percentage).toBe(33);
    expect(res.body.mastered).toBe(false);
  });

  it("ignores answers for unknown questionIds and partial submissions count as wrong", async () => {
    pushDbResult([{ id: 9, courseId: 1, slug: "m4", title: "M4", orderIndex: 3 }]);
    pushDbResult([{ id: 40 }]);
    pushDbResult([
      { id: 400, lessonId: 40, text: "Q", options: ["a", "b", "c", "d"], correctOption: 0, explanation: "ex", funFact: null },
      { id: 401, lessonId: 40, text: "Q", options: ["a", "b", "c", "d"], correctOption: 0, explanation: "ex", funFact: null },
    ]);

    const res = await request(app)
      .post("/api/course-modules/9/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        answers: [
          { questionId: 400, selectedOption: 0 },
          { questionId: 99999, selectedOption: 0 }, // unknown id
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.totalQuestions).toBe(2); // both module questions counted
    expect(res.body.score).toBe(1);
    expect(res.body.percentage).toBe(50);
    expect(res.body.mastered).toBe(false);
    // questionResults should reflect both module questions (one answered, one not)
    expect(res.body.questionResults).toHaveLength(2);
    const unanswered = res.body.questionResults.find((r: { questionId: number }) => r.questionId === 401);
    expect(unanswered.isCorrect).toBe(false);
    expect(unanswered.selectedOption).toBe(-1);
  });
});

describe("GET /api/courses", () => {
  it("requires sign-in (anonymous gets 401)", async () => {
    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(401);
  });

  it("returns an empty array when no courses exist (signed-in)", async () => {
    pushDbResult([]); // courses
    pushDbResult([]); // module counts
    const res = await request(app)
      .get("/api/courses")
      .set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });
});
