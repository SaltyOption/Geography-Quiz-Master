import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const ADMIN_ID = "user_admin_writes_123";
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

const isoNow = "2026-01-02T03:04:05.000Z";
const dateNow = new Date(isoNow);

const sampleQuiz = {
  id: 1,
  title: "Test Quiz",
  description: "Desc",
  category: "geography",
  difficulty: "easy",
  createdAt: dateNow,
  updatedAt: dateNow,
};

const sampleQuestion = {
  id: 10,
  quizId: 1,
  text: "Q?",
  options: ["a", "b", "c", "d"],
  correctOption: 0,
  explanation: "because",
  funFact: null,
  imageUrl: null,
  orderIndex: 0,
  createdAt: dateNow,
  updatedAt: dateNow,
};

const sampleCategory = {
  id: 5,
  name: "Europe",
  slug: "europe",
  parentId: null,
  imageUrl: null,
  createdAt: dateNow,
  updatedAt: dateNow,
};

const asAdmin = (
  method: "post" | "patch" | "delete",
  path: string,
): request.Test =>
  (request(app) as unknown as Record<string, (p: string) => request.Test>)
    [method](path)
    .set("x-test-user-id", ADMIN_ID);

describe("POST /api/quizzes", () => {
  it("returns 400 for invalid body (missing required fields)", async () => {
    const res = await asAdmin("post", "/api/quizzes").send({ title: "Only title" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });

  it("returns 400 for wrong field types", async () => {
    const res = await asAdmin("post", "/api/quizzes").send({
      title: 123,
      description: "x",
      category: "geo",
      difficulty: "easy",
    });
    expect(res.status).toBe(400);
  });

  it("returns 201 with the full serialized quiz body on success", async () => {
    pushDbResult([sampleQuiz]);
    const res = await asAdmin("post", "/api/quizzes").send({
      title: "Test Quiz",
      description: "Desc",
      category: "geography",
      difficulty: "easy",
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 1,
      title: "Test Quiz",
      description: "Desc",
      category: "geography",
      difficulty: "easy",
      createdAt: isoNow,
      updatedAt: isoNow,
    });
  });
});

describe("PATCH /api/quizzes/:id", () => {
  it("returns 400 for invalid body field type", async () => {
    const res = await asAdmin("patch", "/api/quizzes/1").send({ title: 42 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 404 when the quiz does not exist", async () => {
    pushDbResult([]); // update ... returning() → no rows
    const res = await asAdmin("patch", "/api/quizzes/999").send({ title: "Renamed" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Quiz not found" });
  });

  it("returns 200 with the full serialized quiz body on success", async () => {
    pushDbResult([sampleQuiz]);
    const res = await asAdmin("patch", "/api/quizzes/1").send({ title: "Test Quiz" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 1,
      title: "Test Quiz",
      description: "Desc",
      category: "geography",
      difficulty: "easy",
      createdAt: isoNow,
      updatedAt: isoNow,
    });
  });
});

describe("DELETE /api/quizzes/:id", () => {
  it("returns 404 when the quiz does not exist", async () => {
    pushDbResult([]);
    const res = await asAdmin("delete", "/api/quizzes/999");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Quiz not found" });
  });

  it("returns 204 with an empty body on success", async () => {
    pushDbResult([sampleQuiz]);
    const res = await asAdmin("delete", "/api/quizzes/1");
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(res.text).toBe("");
  });
});

describe("POST /api/quizzes/:id/questions", () => {
  it("returns 404 when the parent quiz does not exist", async () => {
    pushDbResult([]); // quiz lookup → empty
    const res = await asAdmin("post", "/api/quizzes/999/questions").send({
      text: "Q?",
      options: ["a", "b", "c", "d"],
      correctOption: 0,
      explanation: "because",
      orderIndex: 0,
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Quiz not found" });
  });

  it("returns 400 for invalid body even when the quiz exists", async () => {
    pushDbResult([sampleQuiz]); // quiz lookup succeeds
    const res = await asAdmin("post", "/api/quizzes/1/questions").send({
      text: "missing options",
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 201 with the full serialized question body on success", async () => {
    pushDbResult([sampleQuiz], [sampleQuestion]);
    const res = await asAdmin("post", "/api/quizzes/1/questions").send({
      text: "Q?",
      options: ["a", "b", "c", "d"],
      correctOption: 0,
      explanation: "because",
      orderIndex: 0,
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 10,
      quizId: 1,
      text: "Q?",
      options: ["a", "b", "c", "d"],
      correctOption: 0,
      explanation: "because",
      funFact: null,
      imageUrl: null,
      orderIndex: 0,
      createdAt: isoNow,
      updatedAt: isoNow,
    });
  });
});

describe("PATCH /api/questions/:id", () => {
  it("returns 400 for invalid body field type", async () => {
    const res = await asAdmin("patch", "/api/questions/10").send({ correctOption: "nope" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 404 when the question does not exist", async () => {
    pushDbResult([]);
    const res = await asAdmin("patch", "/api/questions/999").send({ text: "Updated?" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Question not found" });
  });

  it("returns 200 with the full serialized question body on success", async () => {
    pushDbResult([sampleQuestion]);
    const res = await asAdmin("patch", "/api/questions/10").send({ text: "Q?" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 10,
      quizId: 1,
      text: "Q?",
      options: ["a", "b", "c", "d"],
      correctOption: 0,
      explanation: "because",
      funFact: null,
      imageUrl: null,
      orderIndex: 0,
      createdAt: isoNow,
      updatedAt: isoNow,
    });
  });
});

describe("DELETE /api/questions/:id", () => {
  it("returns 404 when the question does not exist", async () => {
    pushDbResult([]);
    const res = await asAdmin("delete", "/api/questions/999");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Question not found" });
  });

  it("returns 204 with an empty body on success", async () => {
    pushDbResult([sampleQuestion]);
    const res = await asAdmin("delete", "/api/questions/10");
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(res.text).toBe("");
  });
});

describe("POST /api/categories", () => {
  it("returns 400 for invalid body (missing name)", async () => {
    const res = await asAdmin("post", "/api/categories").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when the supplied parentId does not exist", async () => {
    pushDbResult([]); // parent lookup → empty
    const res = await asAdmin("post", "/api/categories").send({
      name: "Europe",
      parentId: 999,
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Parent category does not exist" });
  });

  it("returns 201 with the full serialized category body on success", async () => {
    // uniqueSlug() does select where slug=candidate → empty (slug is free)
    // then insert returning → [sampleCategory]
    pushDbResult([], [sampleCategory]);
    const res = await asAdmin("post", "/api/categories").send({ name: "Europe" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 5,
      name: "Europe",
      slug: "europe",
      parentId: null,
      imageUrl: null,
      createdAt: isoNow,
      updatedAt: isoNow,
    });
  });
});

describe("PATCH /api/categories/:id", () => {
  it("returns 400 for invalid body field type", async () => {
    const res = await asAdmin("patch", "/api/categories/5").send({ name: 12 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when trying to set the category as its own parent", async () => {
    const res = await asAdmin("patch", "/api/categories/5").send({ parentId: 5 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Category cannot be its own parent" });
  });

  it("returns 404 when the category does not exist", async () => {
    pushDbResult([]); // update returning → empty
    const res = await asAdmin("patch", "/api/categories/999").send({ name: "Renamed" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Category not found" });
  });

  it("returns 200 with the full serialized category body on success", async () => {
    pushDbResult([sampleCategory]);
    const res = await asAdmin("patch", "/api/categories/5").send({ name: "Europe" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 5,
      name: "Europe",
      slug: "europe",
      parentId: null,
      imageUrl: null,
      createdAt: isoNow,
      updatedAt: isoNow,
    });
  });
});

describe("DELETE /api/categories/:id", () => {
  it("returns 404 when the category does not exist", async () => {
    pushDbResult([]);
    const res = await asAdmin("delete", "/api/categories/999");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Category not found" });
  });

  it("returns 204 with an empty body on success", async () => {
    pushDbResult([sampleCategory]);
    const res = await asAdmin("delete", "/api/categories/5");
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(res.text).toBe("");
  });
});
