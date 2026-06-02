import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const ADMIN_ID = "user_import_admin_555";
const NON_ADMIN_ID = "user_import_normal_444";
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
    quizId: 9,
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

describe("POST /api/quizzes/:id/questions/import-by-category", () => {
  it("rejects non-admins with 403", async () => {
    const res = await request(app)
      .post("/api/quizzes/5/questions/import-by-category")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ categoryId: 1 });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the quiz does not exist", async () => {
    pushDbResult([]); // quiz lookup (none)
    const res = await request(app)
      .post("/api/quizzes/5/questions/import-by-category")
      .set("x-test-user-id", ADMIN_ID)
      .send({ categoryId: 1 });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the category does not exist", async () => {
    pushDbResult([{ id: 5, title: "Target Quiz" }]); // quiz lookup
    pushDbResult([]); // category lookup (none)
    const res = await request(app)
      .post("/api/quizzes/5/questions/import-by-category")
      .set("x-test-user-id", ADMIN_ID)
      .send({ categoryId: 1 });
    expect(res.status).toBe(404);
  });

  it("copies tagged questions (and their tags) into the quiz", async () => {
    pushDbResult([{ id: 5, title: "Target Quiz" }]); // quiz lookup
    pushDbResult([{ id: 1, name: "Europe", slug: "europe", parentId: null }]); // category lookup
    pushDbResult([{ id: 1, parentId: null }]); // all categories (id, parentId)
    pushDbResult([
      { question: questionRow({ id: 100, quizId: 9, text: "Q1" }) },
      { question: questionRow({ id: 101, quizId: 9, text: "Q2" }) },
    ]); // selectDistinct tagged source questions
    pushDbResult([]); // existing question texts in target quiz (none)
    pushDbResult([
      { questionId: 100, categoryId: 1 },
      { questionId: 101, categoryId: 1 },
    ]); // tags of source questions
    pushDbResult([{ max: null }]); // max orderIndex in target quiz
    pushDbResult([{ id: 500 }, { id: 501 }]); // inserted copies returning ids
    pushDbResult([]); // insert question_categories links

    const res = await request(app)
      .post("/api/quizzes/5/questions/import-by-category")
      .set("x-test-user-id", ADMIN_ID)
      .send({ categoryId: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imported: 2, skipped: 0, categoryName: "Europe" });
  });

  it("skips questions already present in the quiz (by text) and counts them as skipped", async () => {
    pushDbResult([{ id: 5, title: "Target Quiz" }]); // quiz lookup
    pushDbResult([{ id: 1, name: "Europe", slug: "europe", parentId: null }]); // category lookup
    pushDbResult([{ id: 1, parentId: null }]); // all categories
    pushDbResult([
      { question: questionRow({ id: 100, quizId: 9, text: "Q1" }) },
      { question: questionRow({ id: 101, quizId: 9, text: "Already here" }) },
    ]); // tagged source questions
    pushDbResult([{ text: "Already here" }]); // existing question texts in target quiz
    pushDbResult([{ questionId: 100, categoryId: 1 }]); // tags of the one copyable source
    pushDbResult([{ max: 4 }]); // max orderIndex
    pushDbResult([{ id: 500 }]); // inserted copy returning id
    pushDbResult([]); // insert question_categories links

    const res = await request(app)
      .post("/api/quizzes/5/questions/import-by-category")
      .set("x-test-user-id", ADMIN_ID)
      .send({ categoryId: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imported: 1, skipped: 1, categoryName: "Europe" });
  });

  it("returns zeros when no questions are tagged with the category", async () => {
    pushDbResult([{ id: 5, title: "Target Quiz" }]); // quiz lookup
    pushDbResult([{ id: 1, name: "Antarctica", slug: "antarctica", parentId: null }]); // category lookup
    pushDbResult([{ id: 1, parentId: null }]); // all categories
    pushDbResult([]); // no tagged source questions

    const res = await request(app)
      .post("/api/quizzes/5/questions/import-by-category")
      .set("x-test-user-id", ADMIN_ID)
      .send({ categoryId: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imported: 0, skipped: 0, categoryName: "Antarctica" });
  });
});
