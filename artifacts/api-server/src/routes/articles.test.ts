import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult, recordedInserts, recordedUpdates } from "../test/db-mock";

const ADMIN_ID = "user_article_admin";
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

function articleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "The Nile",
    slug: "the-nile",
    summary: null,
    body: "The Nile is a major river.",
    imageUrl: null,
    published: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const asAdmin = (req: request.Test) => req.set("x-test-user-id", ADMIN_ID);

describe("GET /api/articles visibility", () => {
  it("hides draft articles from non-admin visitors", async () => {
    pushDbResult([
      articleRow({ id: 1, title: "Live", slug: "live", published: true }),
      articleRow({ id: 2, title: "Draft", slug: "draft", published: false }),
    ]);

    const res = await request(app).get("/api/articles");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].published).toBe(true);
  });

  it("returns all articles (drafts included) to admins", async () => {
    pushDbResult([
      articleRow({ id: 1, title: "Live", slug: "live", published: true }),
      articleRow({ id: 2, title: "Draft", slug: "draft", published: false }),
    ]);

    const res = await asAdmin(request(app).get("/api/articles"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const draft = res.body.find((a: { id: number }) => a.id === 2);
    expect(draft.published).toBe(false);
  });
});

describe("GET /api/articles/by-slug/:slug visibility", () => {
  it("404s a draft article for non-admin visitors", async () => {
    pushDbResult([articleRow({ id: 7, slug: "secret", published: false })]);
    const res = await request(app).get("/api/articles/by-slug/secret");
    expect(res.status).toBe(404);
  });

  it("returns a draft article to admins", async () => {
    pushDbResult([articleRow({ id: 7, slug: "secret", published: false })]);
    const res = await asAdmin(request(app).get("/api/articles/by-slug/secret"));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(7);
    expect(res.body.published).toBe(false);
  });

  it("returns a published article to non-admin visitors", async () => {
    pushDbResult([articleRow({ id: 8, slug: "live", published: true })]);
    const res = await request(app).get("/api/articles/by-slug/live");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(8);
    expect(res.body.published).toBe(true);
  });
});

describe("POST /api/articles", () => {
  it("auto-generates a slug from the title when none is provided", async () => {
    pushDbResult([]); // uniqueArticleSlug: no existing slug conflict
    pushDbResult([articleRow({ id: 1, title: "Hello World", slug: "hello-world" })]);

    const res = await asAdmin(
      request(app).post("/api/articles").send({ title: "Hello World", body: "Some body" }),
    );
    expect(res.status).toBe(201);
    expect(recordedInserts).toHaveLength(1);
    expect(recordedInserts[0]).toMatchObject({ slug: "hello-world" });
    expect(res.body.slug).toBe("hello-world");
  });

  it("applies the published flag when set", async () => {
    pushDbResult([]); // uniqueArticleSlug: no conflict
    pushDbResult([articleRow({ id: 2, title: "Live", slug: "live", published: true })]);

    const res = await asAdmin(
      request(app)
        .post("/api/articles")
        .send({ title: "Live", body: "Some body", published: true }),
    );
    expect(res.status).toBe(201);
    expect(recordedInserts[0]).toMatchObject({ published: true });
    expect(res.body.published).toBe(true);
  });

  it("rejects non-admins with 403 and never writes", async () => {
    const res = await request(app)
      .post("/api/articles")
      .set("x-test-user-id", "user_regular")
      .send({ title: "Sneaky", body: "Body" });
    expect(res.status).toBe(403);
    expect(recordedInserts).toHaveLength(0);
  });
});

describe("PATCH /api/articles/:id", () => {
  it("applies the published flag on update", async () => {
    pushDbResult([articleRow({ id: 1, published: true })]);

    const res = await asAdmin(
      request(app).patch("/api/articles/1").send({ published: true }),
    );
    expect(res.status).toBe(200);
    expect(recordedUpdates).toHaveLength(1);
    expect(recordedUpdates[0]).toMatchObject({ published: true });
    expect(res.body.published).toBe(true);
  });

  it("re-slugifies a provided slug on update", async () => {
    pushDbResult([]); // uniqueArticleSlug: no conflict
    pushDbResult([articleRow({ id: 1, slug: "new-slug" })]);

    const res = await asAdmin(
      request(app).patch("/api/articles/1").send({ slug: "New Slug" }),
    );
    expect(res.status).toBe(200);
    expect(recordedUpdates[0]).toMatchObject({ slug: "new-slug" });
  });
});
