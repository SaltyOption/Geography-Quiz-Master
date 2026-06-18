import { describe, it, expect, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
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

  it("treats non-optimized URLs as valid (optimized=false, no missing files)", async () => {
    const res = await asAdmin(
      "/api/images/validate?url=" +
        encodeURIComponent("https://example.com/image.jpg"),
    );
    expect(res.status).toBe(200);
    expect(res.body.optimized).toBe(false);
    expect(res.body.missing).toEqual([]);
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
