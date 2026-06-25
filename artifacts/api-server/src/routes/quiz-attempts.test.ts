import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
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

describe("POST /api/quiz-attempts — bypass protection", () => {
  it("deduplicates repeated answers for the same question so the score can't be inflated", async () => {
    // quiz visibility lookup
    pushDbResult([{ published: true }]);
    // The route dedupes by questionId before the questions lookup, so only the
    // single distinct id is queried — return that one question.
    pushDbResult([makeQuestion(100, 0)]);

    // Submit the SAME correct answer 5 times for question 100. Without dedup
    // this would score 5/5; with dedup it must be exactly 1/1.
    const res = await request(app)
      .post("/api/quiz-attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        quizId: 1,
        answers: [
          { questionId: 100, selectedOption: 0 },
          { questionId: 100, selectedOption: 0 },
          { questionId: 100, selectedOption: 0 },
          { questionId: 100, selectedOption: 0 },
          { questionId: 100, selectedOption: 0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.totalQuestions).toBe(1);
    expect(res.body.percentage).toBe(100);
    expect(res.body.questionResults).toHaveLength(1);

    // The persisted answers array is deduplicated too.
    const attemptInsert = recordedInserts.find(
      (p): p is { answers: { questionId: number; selectedOption: number }[] } =>
        typeof p === "object" && p !== null && "answers" in p,
    );
    expect(attemptInsert).toBeDefined();
    expect(attemptInsert?.answers).toHaveLength(1);
  });

  it("ignores answers whose questionId belongs to a different quiz", async () => {
    // quiz visibility lookup (quiz 1, published)
    pushDbResult([{ published: true }]);
    // The questions lookup returns one in-quiz question (quizId 1) and one that
    // belongs to a DIFFERENT quiz (quizId 2) — a cross-quiz id injection. The
    // foreign question's correctOption is 0; the caller "knows" it and answers
    // correctly, trying to score points and probe another quiz's answer key.
    pushDbResult([
      makeQuestion(100, 0), // belongs to quiz 1
      {
        id: 500,
        quizId: 2, // belongs to a different quiz
        text: "Q500",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "secret-explanation",
        funFact: "secret-funfact",
      },
    ]);

    const res = await request(app)
      .post("/api/quiz-attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        quizId: 1,
        answers: [
          { questionId: 100, selectedOption: 0 }, // valid, correct
          { questionId: 500, selectedOption: 0 }, // foreign, "correct" but ignored
        ],
      });

    expect(res.status).toBe(200);
    // Only the in-quiz question is scored — the injected foreign id contributes
    // nothing to the score or the total.
    expect(res.body.score).toBe(1);
    expect(res.body.totalQuestions).toBe(1);
    expect(res.body.questionResults).toHaveLength(1);
    expect(res.body.questionResults[0].questionId).toBe(100);
    // The other quiz's answer key / content is never leaked back to the caller.
    const leaked = JSON.stringify(res.body);
    expect(leaked).not.toContain("secret-explanation");
    expect(leaked).not.toContain("secret-funfact");

    const attemptInsert = recordedInserts.find(
      (p): p is { answers: { questionId: number }[] } =>
        typeof p === "object" && p !== null && "answers" in p,
    );
    // Note: the foreign answer is stored verbatim in the raw answers payload but
    // is never scored — only the in-quiz score/total are persisted.
    expect(attemptInsert).toBeDefined();
  });

  it("returns 400 and writes nothing when no answers are valid for this quiz", async () => {
    // quiz visibility lookup (quiz 1, published)
    pushDbResult([{ published: true }]);
    // The only answered question belongs to a different quiz, so after the
    // in-quiz filter there are zero scorable answers.
    pushDbResult([
      {
        id: 500,
        quizId: 2,
        text: "Q500",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "ex",
        funFact: null,
      },
    ]);

    const res = await request(app)
      .post("/api/quiz-attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        quizId: 1,
        answers: [{ questionId: 500, selectedOption: 0 }],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    // No attempt row with a zero total is persisted.
    expect(recordedInserts).toHaveLength(0);
  });

  it("returns 404 for a non-admin submitting against a draft quiz and writes nothing", async () => {
    // quiz visibility lookup — quiz exists but is unpublished (draft).
    pushDbResult([{ published: false }]);

    const res = await request(app)
      .post("/api/quiz-attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        quizId: 1,
        answers: [{ questionId: 100, selectedOption: 0 }],
      });

    expect(res.status).toBe(404);
    // Draft content is never scored or persisted for a non-admin.
    expect(recordedInserts).toHaveLength(0);
  });
});

describe("POST /api/quiz-attempts — rate limiting", () => {
  // The limiter is an in-memory, module-scoped sliding window: 30 attempts per
  // 10-minute window, keyed by user id (or IP for anonymous callers). It is
  // created once when the route module loads and is shared across every test in
  // this file. There is no exported reset, so to avoid bleeding into (or being
  // polluted by) the other tests we use a dedicated user id whose window starts
  // fresh and is never touched elsewhere.
  const RATE_LIMIT_USER_ID = "user_quiz_attempts_ratelimit_777";
  const MAX_ATTEMPTS = 30;

  function submitOnce() {
    return request(app)
      .post("/api/quiz-attempts")
      .set("x-test-user-id", RATE_LIMIT_USER_ID)
      .send({
        quizId: 1,
        answers: [{ questionId: 100, selectedOption: 0 }],
      });
  }

  it("returns 429 once a user exceeds the window and stops persisting attempts", async () => {
    // Drive the limiter right up to its limit. Each attempt needs its own DB
    // results queued (visibility lookup + questions lookup); we queue them per
    // iteration so the awaited insert at the end of one request doesn't consume
    // the next request's read results.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      pushDbResult([{ published: true }]);
      pushDbResult([makeQuestion(100, 0)]);

      const res = await submitOnce();
      expect(res.status).toBe(200);
    }

    // Every one of the allowed attempts was persisted (one insert each).
    expect(recordedInserts).toHaveLength(MAX_ATTEMPTS);
    const insertsBefore = recordedInserts.length;

    // The next submission is over the limit. The rate-limit check runs before
    // any DB access, so no read results are queued — a 429 here proves nothing
    // was even looked up.
    const blocked = await submitOnce();
    expect(blocked.status).toBe(429);
    expect(blocked.body).toHaveProperty("error");

    // Crucially, the blocked request writes nothing — the limiter stops the
    // write-amplification path, not just the response.
    expect(recordedInserts).toHaveLength(insertsBefore);

    // Still rate-limited on subsequent rapid-fire submissions within the window.
    const blockedAgain = await submitOnce();
    expect(blockedAgain.status).toBe(429);
    expect(recordedInserts).toHaveLength(insertsBefore);
  });

  it("lets a user submit again once their window has elapsed", async () => {
    // Use a dedicated user id (and fake the clock) so this recovery scenario
    // starts from a fresh window, independent of the block-path test above.
    const RECOVERY_USER_ID = "user_quiz_attempts_ratelimit_recovery_555";
    const WINDOW_MS = 10 * 60 * 1000;

    function submitRecovery() {
      return request(app)
        .post("/api/quiz-attempts")
        .set("x-test-user-id", RECOVERY_USER_ID)
        .send({
          quizId: 1,
          answers: [{ questionId: 100, selectedOption: 0 }],
        });
    }

    // Fake only Date so the limiter's Date.now() is controllable while
    // supertest's real network/timer I/O keeps working normally.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-06-25T00:00:00.000Z"));

      // Fill the window right up to the limit.
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        pushDbResult([{ published: true }]);
        pushDbResult([makeQuestion(100, 0)]);
        const res = await submitRecovery();
        expect(res.status).toBe(200);
      }
      const insertsAfterFill = recordedInserts.length;
      expect(insertsAfterFill).toBe(MAX_ATTEMPTS);

      // One more inside the same window is blocked and persists nothing.
      const blocked = await submitRecovery();
      expect(blocked.status).toBe(429);
      expect(recordedInserts).toHaveLength(insertsAfterFill);

      // Advance the clock past the window so the sliding window resets.
      vi.setSystemTime(Date.now() + WINDOW_MS + 1000);

      // The next submission is allowed again — and writes a fresh attempt.
      pushDbResult([{ published: true }]);
      pushDbResult([makeQuestion(100, 0)]);
      const recovered = await submitRecovery();
      expect(recovered.status).toBe(200);
      expect(recovered.body.score).toBe(1);
      expect(recovered.body.totalQuestions).toBe(1);
      expect(recordedInserts).toHaveLength(insertsAfterFill + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
