import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import { resetDbQueue, pushDbResult, recordedUpdates, dbResultQueue } from "../test/db-mock";

const ADMIN_ID = "user_quiz_admin";
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

const asAdmin = (req: request.Test) => req.set("x-test-user-id", ADMIN_ID);

describe("quiz endpoints reject a non-numeric id with 400", () => {
  it("GET /api/quizzes/:id 400s a non-numeric id without reading the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await asAdmin(request(app).get("/api/quizzes/abc"));
    expect(res.status).toBe(400);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });

  it("GET /api/quizzes/:id/stats 400s a non-numeric id without reading the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await asAdmin(request(app).get("/api/quizzes/abc/stats"));
    expect(res.status).toBe(400);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });

  it("PATCH /api/quizzes/:id 400s a non-numeric id without reading or writing the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await asAdmin(
      request(app).patch("/api/quizzes/abc").send({ title: "Renamed" }),
    );
    expect(res.status).toBe(400);
    expect(recordedUpdates).toHaveLength(0);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });

  it("DELETE /api/quizzes/:id 400s a non-numeric id without deleting from the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await asAdmin(request(app).delete("/api/quizzes/abc"));
    expect(res.status).toBe(400);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });
});
