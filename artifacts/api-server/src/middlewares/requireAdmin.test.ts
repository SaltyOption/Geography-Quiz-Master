import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "../routes";
import { resetDbQueue, pushDbResult } from "../test/db-mock";

const ADMIN_ID = "user_admin_123";
const NON_ADMIN_ID = "user_random_456";

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

const isoNow = new Date().toISOString();
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

type WriteEndpoint = {
  name: string;
  method: "post" | "patch" | "delete";
  path: string;
  validBody?: Record<string, unknown>;
  /**
   * Set up the dbMock queue so the admin call returns 2xx.
   * Run before each "admin → 2xx" assertion.
   */
  setupAdminQueue: () => void;
  expectedAdminStatus: number;
};

const writeEndpoints: WriteEndpoint[] = [
  {
    name: "POST /api/quizzes",
    method: "post",
    path: "/api/quizzes",
    validBody: {
      title: "New Quiz",
      description: "A description",
      category: "geography",
      difficulty: "easy",
    },
    setupAdminQueue: () => {
      pushDbResult([sampleQuiz]);
    },
    expectedAdminStatus: 201,
  },
  {
    name: "PATCH /api/quizzes/:id",
    method: "patch",
    path: "/api/quizzes/1",
    validBody: { title: "Renamed" },
    setupAdminQueue: () => {
      pushDbResult([sampleQuiz]);
    },
    expectedAdminStatus: 200,
  },
  {
    name: "DELETE /api/quizzes/:id",
    method: "delete",
    path: "/api/quizzes/1",
    setupAdminQueue: () => {
      pushDbResult([sampleQuiz]);
    },
    expectedAdminStatus: 204,
  },
  {
    name: "POST /api/quizzes/:id/questions",
    method: "post",
    path: "/api/quizzes/1/questions",
    validBody: {
      text: "What is the capital of France?",
      options: ["Paris", "Lyon", "Marseille", "Nice"],
      correctOption: 0,
      explanation: "Paris is the capital.",
      orderIndex: 0,
    },
    setupAdminQueue: () => {
      pushDbResult([sampleQuiz], [sampleQuestion]);
    },
    expectedAdminStatus: 201,
  },
  {
    name: "PATCH /api/questions/:id",
    method: "patch",
    path: "/api/questions/10",
    validBody: { text: "Updated?" },
    setupAdminQueue: () => {
      pushDbResult([sampleQuestion]);
    },
    expectedAdminStatus: 200,
  },
  {
    name: "DELETE /api/questions/:id",
    method: "delete",
    path: "/api/questions/10",
    setupAdminQueue: () => {
      pushDbResult([sampleQuestion]);
    },
    expectedAdminStatus: 204,
  },
  {
    name: "POST /api/categories",
    method: "post",
    path: "/api/categories",
    validBody: { name: "Europe" },
    setupAdminQueue: () => {
      // uniqueSlug → empty result, then insert returning
      pushDbResult([], [sampleCategory]);
    },
    expectedAdminStatus: 201,
  },
  {
    name: "PATCH /api/categories/:id",
    method: "patch",
    path: "/api/categories/5",
    validBody: { name: "Western Europe" },
    setupAdminQueue: () => {
      pushDbResult([sampleCategory]);
    },
    expectedAdminStatus: 200,
  },
  {
    name: "DELETE /api/categories/:id",
    method: "delete",
    path: "/api/categories/5",
    setupAdminQueue: () => {
      pushDbResult([sampleCategory]);
    },
    expectedAdminStatus: 204,
  },
];

describe("requireAdmin middleware (write endpoints)", () => {
  for (const endpoint of writeEndpoints) {
    describe(endpoint.name, () => {
      it("returns 401 when the caller is signed out", async () => {
        const req = request(app)[endpoint.method](endpoint.path);
        const res = endpoint.validBody ? await req.send(endpoint.validBody) : await req;
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Unauthorized" });
      });

      it("returns 403 when the caller is signed in but not on the admin allow-list", async () => {
        const req = request(app)
          [endpoint.method](endpoint.path)
          .set("x-test-user-id", NON_ADMIN_ID);
        const res = endpoint.validBody ? await req.send(endpoint.validBody) : await req;
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Forbidden" });
      });

      it(`returns ${endpoint.expectedAdminStatus} when the caller is an allow-listed admin`, async () => {
        endpoint.setupAdminQueue();
        const req = request(app)
          [endpoint.method](endpoint.path)
          .set("x-test-user-id", ADMIN_ID);
        const res = endpoint.validBody ? await req.send(endpoint.validBody) : await req;
        expect(res.status).toBe(endpoint.expectedAdminStatus);
      });
    });
  }
});

describe("GET /api/me", () => {
  it("returns userId=null and isAdmin=false when signed out", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: null, isAdmin: false });
  });

  it("returns the userId and isAdmin=false when signed in but not allow-listed", async () => {
    const res = await request(app).get("/api/me").set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: NON_ADMIN_ID, isAdmin: false });
  });

  it("returns the userId and isAdmin=true when signed in as an allow-listed admin", async () => {
    const res = await request(app).get("/api/me").set("x-test-user-id", ADMIN_ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: ADMIN_ID, isAdmin: true });
  });
});
