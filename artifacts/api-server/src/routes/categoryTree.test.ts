import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import router from "./index";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const app = express();
app.use(express.json());
app.use("/api", router);

const now = new Date("2026-01-01T00:00:00.000Z");

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

beforeEach(() => {
  resetDbQueue();
});

describe("GET /api/categories/tree", () => {
  it("returns descendant-inclusive, de-duplicated taggedQuestionCount per node", async () => {
    // Tree: Region(1) -> Africa(2) -> Cities(3); plus a sibling Topic(4) with no tags.
    pushDbResult([
      categoryRow({ id: 1, name: "Region", slug: "region", parentId: null }),
      categoryRow({ id: 2, name: "Africa", slug: "africa", parentId: 1 }),
      categoryRow({ id: 3, name: "Cities", slug: "cities", parentId: 2 }),
      categoryRow({ id: 4, name: "Topic", slug: "topic", parentId: null }),
    ]);
    // quiz links joined with quizzes.published; counted in JS per category.
    pushDbResult([{ categoryId: 2, published: true }]);
    // question_categories tag rows. Question 100 tagged on both Africa(2) and
    // Cities(3) must only count once at the ancestor level.
    pushDbResult([
      { categoryId: 3, questionId: 100, published: true },
      { categoryId: 3, questionId: 101, published: true },
      { categoryId: 2, questionId: 100, published: true },
    ]);

    const res = await request(app).get("/api/categories/tree");
    expect(res.status).toBe(200);

    const region = res.body.find((n: { id: number }) => n.id === 1);
    const africa = region.children.find((n: { id: number }) => n.id === 2);
    const cities = africa.children.find((n: { id: number }) => n.id === 3);
    const topic = res.body.find((n: { id: number }) => n.id === 4);

    // Cities: questions 100, 101 -> 2
    expect(cities.taggedQuestionCount).toBe(2);
    // Africa: own 100 + descendants {100,101} -> distinct {100,101} -> 2
    expect(africa.taggedQuestionCount).toBe(2);
    // Region: inherits Africa subtree -> 2
    expect(region.taggedQuestionCount).toBe(2);
    // Topic: no tags -> 0
    expect(topic.taggedQuestionCount).toBe(0);
  });
});
