import { describe, it, expect, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import type { ExternalImageResult } from "@workspace/image-check";

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
