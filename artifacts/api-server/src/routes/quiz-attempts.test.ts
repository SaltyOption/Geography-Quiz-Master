import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult, recordedInserts } from "../test/db-mock";

const ADMIN_ID = "user_quiz_attempts_admin_999";
const NON_ADMIN_ID = "user_quiz_attempts_normal_888";
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

function makeQuestion(
  id: number,
  correctOption: number,
): {
  id: number;
  quizId: number;
  text: string;
  options: string[];
  correctOption: number;
  explanation: string;
  funFact: string | null;
} {
  return {
    id,
    quizId: 1,
    text: `Q${id}`,
    options: ["a", "b", "c", "d"],
    correctOption,
    explanation: `ex${id}`,
    funFact: null,
  };
}

describe("POST /api/quiz-attempts", () => {
  it("persists the computed score for a signed-in attempt", async () => {
    // quiz visibility lookup
    pushDbResult([{ published: true }]);
    // questions lookup
    pushDbResult([
      makeQuestion(100, 0),
      makeQuestion(101, 1),
      makeQuestion(102, 2),
      makeQuestion(103, 3),
    ]);

    const res = await request(app)
      .post("/api/quiz-attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        quizId: 1,
        answers: [
          { questionId: 100, selectedOption: 0 }, // correct
          { questionId: 101, selectedOption: 1 }, // correct
          { questionId: 102, selectedOption: 2 }, // correct
          { questionId: 103, selectedOption: 0 }, // wrong
        ],
      });

    expect(res.status).toBe(200);
    // Sanity-check the response the browser sees.
    expect(res.body.score).toBe(3);
    expect(res.body.totalQuestions).toBe(4);
    expect(res.body.percentage).toBe(75);

    // The recorded insert is the attempt row written to the DB. Assert the
    // persisted values match the computed result, not just the JSON response.
    const attemptInsert = recordedInserts.find(
      (
        p,
      ): p is {
        quizId: number;
        userId: string;
        score: number;
        totalQuestions: number;
        answers: { questionId: number; selectedOption: number }[];
      } =>
        typeof p === "object" &&
        p !== null &&
        "quizId" in p &&
        "score" in p &&
        "totalQuestions" in p,
    );
    expect(attemptInsert).toBeDefined();
    expect(attemptInsert).toMatchObject({
      quizId: 1,
      userId: NON_ADMIN_ID,
      score: 3,
      totalQuestions: 4,
      answers: [
        { questionId: 100, selectedOption: 0 },
        { questionId: 101, selectedOption: 1 },
        { questionId: 102, selectedOption: 2 },
        { questionId: 103, selectedOption: 0 },
      ],
    });
  });

  it("does not persist an attempt for an anonymous user", async () => {
    pushDbResult([{ published: true }]);
    pushDbResult([makeQuestion(200, 0)]);

    const res = await request(app)
      .post("/api/quiz-attempts")
      .send({
        quizId: 1,
        answers: [{ questionId: 200, selectedOption: 0 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.totalQuestions).toBe(1);
    // Anonymous users get a scored result but nothing is written to the DB.
    expect(recordedInserts).toHaveLength(0);
  });
});
