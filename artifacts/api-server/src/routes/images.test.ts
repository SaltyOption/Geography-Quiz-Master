import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import type { ExternalImageResult } from "@workspace/image-check";
import { pushDbResult, resetDbQueue } from "../test/db-mock";

// Control external reachability without hitting the network.
let nextExternalResult: ExternalImageResult = { status: "ok" };
vi.mock("@workspace/image-check", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/image-check")>();
  return {
    ...actual,
    checkExternalImageUrl: vi.fn(async () => nextExternalResult),
  };
});

import router from "./index";

const ADMIN_ID = "user_admin_images_123";
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

const asAdmin = (path: string): request.Test =>
  request(app).get(path).set("x-test-user-id", ADMIN_ID);

describe("GET /api/images/validate", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get(
      "/api/images/validate?url=/regions/foo.png",
    );
    expect(res.status).toBe(401);
  });

  it("rejects non-admin signed-in users with 403", async () => {
    const res = await request(app)
      .get("/api/images/validate?url=/regions/foo.png")
      .set("x-test-user-id", "user_not_admin");
    expect(res.status).toBe(403);
  });

  it("returns 400 when the url query param is missing", async () => {
    const res = await asAdmin("/api/images/validate");
    expect(res.status).toBe(400);
  });

  it("reports a reachable external URL (optimized=false, reachable=true)", async () => {
    nextExternalResult = { status: "ok" };
    const res = await asAdmin(
      "/api/images/validate?url=" +
        encodeURIComponent("https://example.com/image.jpg"),
    );
    expect(res.status).toBe(200);
    expect(res.body.optimized).toBe(false);
    expect(res.body.missing).toEqual([]);
    expect(res.body.reachable).toBe(true);
    expect(res.body.message).toBeNull();
  });

  it("reports a broken external URL (reachable=false, with message)", async () => {
    nextExternalResult = { status: "broken", reason: "returned 404" };
    const res = await asAdmin(
      "/api/images/validate?url=" +
        encodeURIComponent("https://example.com/missing.jpg"),
    );
    expect(res.status).toBe(200);
    expect(res.body.optimized).toBe(false);
    expect(res.body.reachable).toBe(false);
    expect(typeof res.body.message).toBe("string");
  });

  it("does not flag a transient external failure (reachable=null, no message)", async () => {
    nextExternalResult = { status: "transient", reason: "timed out" };
    const res = await asAdmin(
      "/api/images/validate?url=" +
        encodeURIComponent("https://example.com/flaky.jpg"),
    );
    expect(res.status).toBe(200);
    expect(res.body.reachable).toBeNull();
    expect(res.body.message).toBeNull();
  });

  it("reports missing files for an unhosted optimized URL", async () => {
    const res = await asAdmin(
      "/api/images/validate?url=" +
        encodeURIComponent("/regions/this-does-not-exist-xyz.png"),
    );
    expect(res.status).toBe(200);
    expect(res.body.optimized).toBe(true);
    expect(Array.isArray(res.body.missing)).toBe(true);
    expect(res.body.missing.length).toBeGreaterThan(0);
    expect(typeof res.body.message).toBe("string");
  });
});

describe("GET /api/images/gallery", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/images/gallery");
    expect(res.status).toBe(401);
  });

  it("rejects non-admin signed-in users with 403", async () => {
    const res = await request(app)
      .get("/api/images/gallery")
      .set("x-test-user-id", "user_not_admin");
    expect(res.status).toBe(403);
  });

  it("returns groups of hosted images with all responsive variants present", async () => {
    const res = await asAdmin("/api/images/gallery");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.groups)).toBe(true);
    expect(res.body.groups.length).toBeGreaterThan(0);

    for (const group of res.body.groups) {
      expect(typeof group.prefix).toBe("string");
      expect(typeof group.label).toBe("string");
      expect(Array.isArray(group.images)).toBe(true);
      for (const img of group.images) {
        expect(typeof img.url).toBe("string");
        expect(typeof img.name).toBe("string");
        expect(img.url.startsWith(group.prefix)).toBe(true);
      }
    }

    // Every returned URL must pass the same write-time validation, so an admin
    // picking one can never produce a broken-image save.
    const { findMissingImageFiles } = await import("../lib/imageValidation");
    for (const group of res.body.groups) {
      for (const img of group.images) {
        expect(findMissingImageFiles(img.url)).toEqual([]);
      }
    }
  });
});

describe("GET /api/images/scan", () => {
  beforeEach(() => {
    resetDbQueue();
  });

  // Queue order mirrors collectImageRefs' Promise.all([questions, categories,
  // courses]).
  const queueRefs = (refs: {
    questions?: unknown[];
    categories?: unknown[];
    courses?: unknown[];
  }): void => {
    pushDbResult(refs.questions ?? []);
    pushDbResult(refs.categories ?? []);
    pushDbResult(refs.courses ?? []);
  };

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/images/scan");
    expect(res.status).toBe(401);
  });

  it("rejects non-admin signed-in users with 403", async () => {
    const res = await request(app)
      .get("/api/images/scan")
      .set("x-test-user-id", "user_not_admin");
    expect(res.status).toBe(403);
  });

  it("reports a broken external URL with owner context", async () => {
    nextExternalResult = { status: "broken", reason: "returned 404" };
    queueRefs({
      questions: [
        {
          id: 7,
          url: "https://example.com/missing.jpg",
          text: "What is the capital of France?",
          quizId: 3,
        },
      ],
      courses: [
        {
          id: 2,
          url: "https://example.com/cover.png",
          title: "Africa 101",
          slug: "africa-101",
        },
      ],
    });

    const res = await asAdmin("/api/images/scan");
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(2);
    expect(res.body.brokenCount).toBe(2);
    expect(res.body.transientCount).toBe(0);

    const question = res.body.broken.find(
      (b: { source: string }) => b.source === "question",
    );
    expect(question).toMatchObject({
      id: 7,
      quizId: 3,
      slug: null,
      label: "What is the capital of France?",
      reason: "returned 404",
    });

    const course = res.body.broken.find(
      (b: { source: string }) => b.source === "course",
    );
    expect(course).toMatchObject({ id: 2, slug: "africa-101", quizId: null });
  });

  it("does not report transient external failures as broken", async () => {
    nextExternalResult = { status: "transient", reason: "timed out" };
    queueRefs({
      categories: [
        { id: 5, url: "https://example.com/flaky.jpg", name: "Europe" },
      ],
    });

    const res = await asAdmin("/api/images/scan");
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(1);
    expect(res.body.brokenCount).toBe(0);
    expect(res.body.transientCount).toBe(1);
    expect(res.body.broken).toEqual([]);
  });

  it("reports an unhosted optimized local URL as broken", async () => {
    nextExternalResult = { status: "ok" };
    queueRefs({
      categories: [
        {
          id: 9,
          url: "/regions/this-does-not-exist-xyz.png",
          name: "Nowhere",
        },
      ],
    });

    const res = await asAdmin("/api/images/scan");
    expect(res.status).toBe(200);
    expect(res.body.brokenCount).toBe(1);
    const item = res.body.broken[0];
    expect(item).toMatchObject({ source: "category", id: 9 });
    expect(item.reason).toContain("missing");
  });

  it("reports no broken images when every URL is reachable", async () => {
    nextExternalResult = { status: "ok" };
    queueRefs({
      questions: [
        {
          id: 1,
          url: "https://example.com/ok.jpg",
          text: "Q",
          quizId: 1,
        },
      ],
    });

    const res = await asAdmin("/api/images/scan");
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(1);
    expect(res.body.brokenCount).toBe(0);
    expect(res.body.broken).toEqual([]);
  });
});
