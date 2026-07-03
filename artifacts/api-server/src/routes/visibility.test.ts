import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const ADMIN_ID = "user_visibility_admin";
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
  return {
    id: 1,
    title: "Quiz",
    description: "Desc",
    category: "geography",
    difficulty: "easy",
    published: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Cat",
    slug: "cat",
    parentId: null,
    imageUrl: null,
    published: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("GET /api/quizzes visibility", () => {
  it("hides draft quizzes from non-admin visitors and exposes published flag", async () => {
    pushDbResult([
      quizRow({ id: 1, title: "Live", published: true }),
      quizRow({ id: 2, title: "Draft", published: false }),
    ]);
    pushDbResult([]); // question counts
    pushDbResult([]); // category links

    const res = await request(app).get("/api/quizzes");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].published).toBe(true);
  });

  it("returns draft quizzes to admins", async () => {
    pushDbResult([
      quizRow({ id: 1, title: "Live", published: true }),
      quizRow({ id: 2, title: "Draft", published: false }),
    ]);
    pushDbResult([]); // question counts
    pushDbResult([]); // category links

    const res = await request(app)
      .get("/api/quizzes")
      .set("x-test-user-id", ADMIN_ID);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const draft = res.body.find((q: { id: number }) => q.id === 2);
    expect(draft.published).toBe(false);
  });
});

describe("GET /api/quizzes/:id visibility", () => {
  it("404s a draft quiz for non-admin visitors", async () => {
    pushDbResult([quizRow({ id: 7, published: false })]);
    const res = await request(app).get("/api/quizzes/7");
    expect(res.status).toBe(404);
  });

  it("returns a draft quiz to admins", async () => {
    pushDbResult([quizRow({ id: 7, published: false })]); // quiz lookup
    pushDbResult([]); // questions
    pushDbResult([]); // quiz categories
    pushDbResult([]); // question categories

    const res = await request(app)
      .get("/api/quizzes/7")
      .set("x-test-user-id", ADMIN_ID);
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(false);
  });
});

describe("GET /api/quizzes/:id/questions visibility", () => {
  it("404s questions of a draft quiz for non-admin visitors", async () => {
    pushDbResult([{ published: false }]); // quiz lookup
    const res = await request(app).get("/api/quizzes/7/questions");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/questions/:id visibility", () => {
  it("404s a question whose quiz is a draft for non-admin visitors", async () => {
    pushDbResult([{ id: 5, quizId: 7, options: ["a", "b"], correctOption: 0, createdAt: now, updatedAt: now }]);
    pushDbResult([{ published: false }]); // parent quiz lookup
    const res = await request(app).get("/api/questions/5");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/user/progress visibility", () => {
  // Draft-quiz attempts are excluded in the SQL WHERE (published = true for
  // non-admins), which this FIFO mock cannot evaluate — the queued rows below
  // are the already-filtered result set. The route runs two queries: the
  // aggregate stats row, then the recent-attempts page.
  it("serves stats and attempts from the visibility-filtered queries", async () => {
    pushDbResult(
      [{ totalAttempts: 1, totalQuizzesTaken: 1, averagePercentage: 100, bestPercentage: 100 }],
      [{ id: 1, quizId: 7, quizTitle: "Live", score: 3, totalQuestions: 3, completedAt: now }],
    );
    const res = await request(app)
      .get("/api/user/progress")
      .set("x-test-user-id", "user_regular");
    expect(res.status).toBe(200);
    expect(res.body.totalAttempts).toBe(1);
    expect(res.body.recentAttempts.map((a: { quizId: number }) => a.quizId)).toEqual([7]);
  });
});

describe("POST /api/quiz-attempts visibility", () => {
  it("404s a submission against a draft quiz for non-admins", async () => {
    pushDbResult([{ published: false }]); // quiz lookup
    const res = await request(app)
      .post("/api/quiz-attempts")
      .send({ quizId: 7, answers: [{ questionId: 5, selectedOption: 0 }] });
    expect(res.status).toBe(404);
  });

  it("ignores questions that do not belong to the submitted quiz", async () => {
    pushDbResult([{ published: true }]); // quiz lookup (published)
    pushDbResult([
      { id: 5, quizId: 7, correctOption: 0, explanation: "", funFact: null },
      { id: 99, quizId: 42, correctOption: 1, explanation: "leak", funFact: "leak" },
    ]); // questions
    pushDbResult([]); // attempt insert

    const res = await request(app)
      .post("/api/quiz-attempts")
      .send({
        quizId: 7,
        answers: [
          { questionId: 5, selectedOption: 0 },
          { questionId: 99, selectedOption: 1 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.totalQuestions).toBe(1);
    expect(res.body.questionResults.map((r: { questionId: number }) => r.questionId)).toEqual([5]);
  });
});

describe("GET /api/quizzes/:id/questions tag visibility", () => {
  it("excludes draft category tags from question payloads for non-admins", async () => {
    pushDbResult([{ published: true }]); // parent quiz (published)
    pushDbResult([
      { id: 5, quizId: 7, text: "Q", options: ["a", "b"], correctOption: 0, explanation: "", funFact: null, imageUrl: null, orderIndex: 0, createdAt: now, updatedAt: now },
    ]); // questions
    pushDbResult([
      categoryRow({ id: 10, slug: "live", published: true }),
      categoryRow({ id: 11, slug: "hidden", published: false }),
    ]); // getVisibleCategoryIds -> all categories
    pushDbResult([
      { questionId: 5, category: categoryRow({ id: 10, slug: "live", published: true }) },
      { questionId: 5, category: categoryRow({ id: 11, slug: "hidden", published: false }) },
    ]); // question-category join

    const res = await request(app).get("/api/quizzes/7/questions");
    expect(res.status).toBe(200);
    expect(res.body[0].categories.map((c: { id: number }) => c.id)).toEqual([10]);
  });
});

describe("GET /api/categories/by-slug visibility", () => {
  it("404s a draft category for non-admin visitors", async () => {
    pushDbResult([categoryRow({ id: 3, slug: "secret", published: false })]);
    const res = await request(app).get("/api/categories/by-slug/secret");
    expect(res.status).toBe(404);
  });

  it("404s a published category that has a draft ancestor for non-admins", async () => {
    // Direct slug lookup returns the published child...
    pushDbResult([categoryRow({ id: 2, slug: "child", parentId: 1, published: true })]);
    // ...but the full tree reveals its parent is a draft.
    pushDbResult([
      categoryRow({ id: 1, slug: "root", parentId: null, published: false }),
      categoryRow({ id: 2, slug: "child", parentId: 1, published: true }),
    ]);
    const res = await request(app).get("/api/categories/by-slug/child");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/categories visibility", () => {
  it("prunes drafts and subtrees of drafts for non-admin visitors", async () => {
    // Root(1) published -> Child(2) draft -> Grandchild(3) published.
    // Non-admin should see only Root(1): Child is draft, Grandchild has a draft ancestor.
    pushDbResult([
      categoryRow({ id: 1, slug: "root", parentId: null, published: true }),
      categoryRow({ id: 2, slug: "child", parentId: 1, published: false }),
      categoryRow({ id: 3, slug: "grandchild", parentId: 2, published: true }),
    ]);
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: number }) => c.id)).toEqual([1]);
  });
});

describe("GET /api/categories/tree taggedQuestionCount visibility", () => {
  it("excludes questions of draft quizzes from non-admin tag counts", async () => {
    pushDbResult([categoryRow({ id: 1, slug: "root", parentId: null, published: true })]);
    pushDbResult([]); // quiz links
    // Two tagged questions on cat 1: one from a published quiz, one from a draft.
    pushDbResult([
      { categoryId: 1, questionId: 100, published: true },
      { categoryId: 1, questionId: 101, published: false },
    ]);

    const res = await request(app).get("/api/categories/tree");
    expect(res.status).toBe(200);
    expect(res.body[0].taggedQuestionCount).toBe(1);
  });
});

describe("GET /api/categories/tree visibility", () => {
  it("prunes draft subtrees for non-admin visitors", async () => {
    pushDbResult([
      categoryRow({ id: 1, slug: "root", parentId: null, published: true }),
      categoryRow({ id: 2, slug: "child", parentId: 1, published: false }),
    ]);
    pushDbResult([]); // quiz links
    pushDbResult([]); // tag rows

    const res = await request(app).get("/api/categories/tree");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].published).toBe(true);
    expect(res.body[0].children).toHaveLength(0);
  });
});
