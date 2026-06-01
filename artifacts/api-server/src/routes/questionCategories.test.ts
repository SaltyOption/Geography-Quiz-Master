import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const ADMIN_ID = "user_qcat_admin_777";
const NON_ADMIN_ID = "user_qcat_normal_666";
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

function questionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    quizId: 5,
    text: "Capital of France?",
    options: ["Paris", "Rome", "Madrid", "Berlin"],
    correctOption: 0,
    explanation: "Paris is the capital of France.",
    funFact: null,
    imageUrl: null,
    orderIndex: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("GET /api/categories/by-slug/:slug/practice", () => {
  it("returns 404 when the category does not exist", async () => {
    pushDbResult([]); // category lookup
    const res = await request(app).get("/api/categories/by-slug/nope/practice");
    expect(res.status).toBe(404);
  });

  it("returns tagged questions for the category and its descendants", async () => {
    pushDbResult([{ id: 1, name: "Europe", slug: "europe", parentId: null }]); // category lookup
    pushDbResult([{ id: 1, parentId: null }]); // all categories (id, parentId)
    pushDbResult([
      { question: questionRow({ id: 100, text: "Q1" }) },
      { question: questionRow({ id: 101, text: "Q2", correctOption: 2 }) },
    ]); // selectDistinct joined rows

    const res = await request(app).get("/api/categories/by-slug/europe/practice");

    expect(res.status).toBe(200);
    expect(res.body.category).toEqual({ id: 1, name: "Europe", slug: "europe" });
    expect(res.body.questions).toHaveLength(2);
    const ids = res.body.questions.map((q: { id: number }) => q.id).sort();
    expect(ids).toEqual([100, 101]);
    // Practice questions must not leak quizId or category tags.
    expect(res.body.questions[0]).not.toHaveProperty("quizId");
    expect(res.body.questions[0]).toHaveProperty("correctOption");
  });

  it("caps the number of returned questions at the requested limit", async () => {
    pushDbResult([{ id: 1, name: "Europe", slug: "europe", parentId: null }]);
    pushDbResult([{ id: 1, parentId: null }]);
    pushDbResult(
      Array.from({ length: 10 }, (_, i) => ({ question: questionRow({ id: 200 + i }) })),
    );

    const res = await request(app).get("/api/categories/by-slug/europe/practice?limit=3");
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
  });
});

describe("POST /api/quizzes/:id/questions — category tagging", () => {
  it("rejects non-admins with 403", async () => {
    const res = await request(app)
      .post("/api/quizzes/5/questions")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        text: "Capital of France?",
        options: ["Paris", "Rome", "Madrid", "Berlin"],
        correctOption: 0,
        explanation: "Paris is the capital of France.",
        orderIndex: 0,
        categoryIds: [1],
      });
    expect(res.status).toBe(403);
  });

  it("creates a question and tags it with the given categories", async () => {
    pushDbResult([{ id: 5, title: "World Capitals" }]); // quiz lookup
    pushDbResult([questionRow()]); // insert question returning
    pushDbResult([]); // setQuestionCategories: delete existing links
    pushDbResult([{ id: 1 }]); // setQuestionCategories: valid category ids
    pushDbResult([]); // setQuestionCategories: insert links
    pushDbResult([
      { questionId: 100, category: { id: 1, name: "Capitals", slug: "capitals" } },
    ]); // getCategoriesForQuestion

    const res = await request(app)
      .post("/api/quizzes/5/questions")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        text: "Capital of France?",
        options: ["Paris", "Rome", "Madrid", "Berlin"],
        correctOption: 0,
        explanation: "Paris is the capital of France.",
        orderIndex: 0,
        categoryIds: [1],
      });

    expect(res.status).toBe(201);
    expect(res.body.categories).toEqual([{ id: 1, name: "Capitals", slug: "capitals" }]);
  });
});

describe("PATCH /api/questions/:id — category tagging", () => {
  it("replaces a question's tags when categoryIds is provided", async () => {
    pushDbResult([questionRow({ id: 200, quizId: 7 })]); // select question (no other fields to update)
    pushDbResult([]); // setQuestionCategories: delete existing links
    pushDbResult([{ id: 2 }]); // setQuestionCategories: valid category ids
    pushDbResult([]); // setQuestionCategories: insert links
    pushDbResult([
      { questionId: 200, category: { id: 2, name: "Cities", slug: "cities" } },
    ]); // getCategoriesForQuestion

    const res = await request(app)
      .patch("/api/questions/200")
      .set("x-test-user-id", ADMIN_ID)
      .send({ categoryIds: [2] });

    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([{ id: 2, name: "Cities", slug: "cities" }]);
  });
});

describe("POST /api/quizzes/bulk-import — category tagging", () => {
  const item = {
    topic: "World Capitals",
    question: "Capital of France?",
    options: { A: "Paris", B: "Rome", C: "Madrid", D: "Berlin" },
    correct_answer: "A",
    explanation: "Paris is the capital of France.",
    categories: ["Capitals"],
  };

  it("creates a missing category and tags imported questions with it", async () => {
    pushDbResult([]); // existing categories (none)
    pushDbResult([]); // quiz lookup by title (none -> create)
    pushDbResult([{ id: 10 }]); // insert quiz returning
    pushDbResult([{ max: null }]); // max orderIndex
    pushDbResult([{ id: 100 }]); // insert questions returning ids
    pushDbResult([]); // uniqueSlug: slug conflict check (none)
    pushDbResult([{ id: 1, name: "Capitals", slug: "capitals" }]); // insert category returning
    pushDbResult([]); // insert question_categories links

    const res = await request(app)
      .post("/api/quizzes/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [item] });

    expect(res.status).toBe(200);
    expect(res.body.quizzesCreated).toBe(1);
    expect(res.body.questionsAdded).toBe(1);
    expect(res.body.categoriesCreated).toEqual(["Capitals"]);
  });

  it("reuses an existing category by name without creating a new one", async () => {
    pushDbResult([{ id: 1, name: "Capitals", slug: "capitals", parentId: null }]); // existing categories
    pushDbResult([]); // quiz lookup by title (none -> create)
    pushDbResult([{ id: 10 }]); // insert quiz returning
    pushDbResult([{ max: null }]); // max orderIndex
    pushDbResult([{ id: 100 }]); // insert questions returning ids
    pushDbResult([]); // insert question_categories links

    const res = await request(app)
      .post("/api/quizzes/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [item] });

    expect(res.status).toBe(200);
    expect(res.body.quizzesCreated).toBe(1);
    expect(res.body.questionsAdded).toBe(1);
    expect(res.body.categoriesCreated).toEqual([]);
  });
});
