import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { clerkMiddleware } from "@clerk/express";
import router from "./index";
import {
  resetDbQueue,
  pushDbResult,
  recordedInserts,
  recordedUpdates,
  recordedDeletes,
  dbResultQueue,
} from "../test/db-mock";
import { courseModuleProgressTable } from "@workspace/db";

const ADMIN_ID = "user_courses_admin_999";
const NON_ADMIN_ID = "user_courses_normal_888";
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

const minimalImportItem = {
  topic: "World Deserts",
  module: "Module 1: Intro",
  lesson: "Lesson 1",
  question: "What is the largest hot desert?",
  options: { A: "Sahara", B: "Gobi", C: "Atacama", D: "Kalahari" },
  correct_answer: "A",
  explanation: "The Sahara covers about 9 million sq km.",
};

describe("POST /api/courses/bulk-import", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .send({ items: [minimalImportItem] });
    expect(res.status).toBe(401);
  });

  it("rejects non-admin users with 403", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ items: [minimalImportItem] });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body shape (missing items)", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when items array is empty", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when items contain multiple topics", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        items: [
          minimalImportItem,
          { ...minimalImportItem, topic: "Other Topic" },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/single topic/i);
  });

  it("rejects items with bad correct_answer", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [{ ...minimalImportItem, correct_answer: "Z" }] });
    expect(res.status).toBe(400);
  });

  it("rejects a course image_url under an optimized prefix with missing variants", async () => {
    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        items: [
          {
            ...minimalImportItem,
            image_url: "/regions/__definitely-not-a-real-image__.jpg",
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not hosted/i);
  });
});

describe("POST /api/courses/bulk-import — cover image rules", () => {
  const COVER_URL = "https://images.example.com/deserts-cover.jpg";
  const OTHER_COVER_URL = "https://images.example.com/new-cover.jpg";

  // Queue the DB reads for an existing-course import where the module, lesson,
  // and question already exist (so the import is an idempotent no-op apart from
  // any cover-image side effect). Call AFTER pushing the course lookup result.
  function pushExistingCourseStructure(questionText: string): void {
    pushDbResult([{ max: 0 }]); // maxModuleRow
    pushDbResult([
      { id: 5, courseId: 1, slug: "module-1-intro", title: "Module 1: Intro", orderIndex: 0 },
    ]); // existing module
    pushDbResult([{ max: 0 }]); // maxLessonRow
    pushDbResult([
      { id: 10, moduleId: 5, slug: "lesson-1", title: "Lesson 1", orderIndex: 0 },
    ]); // existing lesson
    pushDbResult([{ max: 0 }]); // maxQ
    pushDbResult([{ text: questionText }]); // existing questions -> duplicate, skip insert
  }

  it("stores the first image_url when creating a fresh course", async () => {
    pushDbResult([]); // course lookup -> none, so create
    pushDbResult([]); // uniqueCourseSlug lookup -> slug available
    pushDbResult([{ id: 1, slug: "world-deserts" }]); // insert course returning
    pushDbResult([{ max: null }]); // maxModuleRow
    pushDbResult([]); // existing module -> none
    pushDbResult([{ id: 5 }]); // insert module returning
    pushDbResult([{ max: null }]); // maxLessonRow
    pushDbResult([]); // existing lesson -> none
    pushDbResult([{ id: 10 }]); // insert lesson returning
    pushDbResult([{ max: null }]); // maxQ
    pushDbResult([]); // existing questions -> none
    pushDbResult([]); // insert questions

    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [{ ...minimalImportItem, image_url: COVER_URL }] });

    expect(res.status).toBe(200);
    expect(res.body.courseCreated).toBe(true);
    const courseInsert = recordedInserts.find(
      (v): v is { imageUrl?: unknown } =>
        typeof v === "object" && v !== null && "imageUrl" in v,
    );
    expect(courseInsert?.imageUrl).toBe(COVER_URL);
    // No update path runs when creating a fresh course.
    expect(recordedUpdates).toHaveLength(0);
  });

  it("leaves an existing cover untouched on re-import without replace_image", async () => {
    pushDbResult([
      { id: 1, slug: "world-deserts", title: "World Deserts", imageUrl: COVER_URL },
    ]); // course lookup -> existing with a cover
    pushExistingCourseStructure(minimalImportItem.question);

    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [{ ...minimalImportItem, image_url: OTHER_COVER_URL }] });

    expect(res.status).toBe(200);
    expect(res.body.courseCreated).toBe(false);
    // No cover update: existing cover is preserved without replace_image.
    expect(recordedUpdates).toHaveLength(0);
  });

  it("fills a missing cover on re-import when none was set", async () => {
    pushDbResult([
      { id: 1, slug: "world-deserts", title: "World Deserts", imageUrl: null },
    ]); // course lookup -> existing, no cover
    pushExistingCourseStructure(minimalImportItem.question);

    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({ items: [{ ...minimalImportItem, image_url: COVER_URL }] });

    expect(res.status).toBe(200);
    expect(recordedUpdates).toHaveLength(1);
    expect(recordedUpdates[0]).toEqual({ imageUrl: COVER_URL });
  });

  it("overwrites an existing cover when replace_image is set", async () => {
    pushDbResult([
      { id: 1, slug: "world-deserts", title: "World Deserts", imageUrl: COVER_URL },
    ]); // course lookup -> existing with a cover
    pushExistingCourseStructure(minimalImportItem.question);

    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        items: [{ ...minimalImportItem, image_url: OTHER_COVER_URL }],
        replace_image: true,
      });

    expect(res.status).toBe(200);
    expect(recordedUpdates).toHaveLength(1);
    expect(recordedUpdates[0]).toEqual({ imageUrl: OTHER_COVER_URL });
  });

  it("removes the cover with clear_image when no image_url is supplied", async () => {
    pushDbResult([
      { id: 1, slug: "world-deserts", title: "World Deserts", imageUrl: COVER_URL },
    ]); // course lookup -> existing with a cover
    pushExistingCourseStructure(minimalImportItem.question);

    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        items: [minimalImportItem], // no image_url
        clear_image: true,
      });

    expect(res.status).toBe(200);
    expect(recordedUpdates).toHaveLength(1);
    expect(recordedUpdates[0]).toEqual({ imageUrl: null });
  });

  it("ignores clear_image when an image_url is present", async () => {
    pushDbResult([
      { id: 1, slug: "world-deserts", title: "World Deserts", imageUrl: COVER_URL },
    ]); // course lookup -> existing with a cover
    pushExistingCourseStructure(minimalImportItem.question);

    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        items: [{ ...minimalImportItem, image_url: OTHER_COVER_URL }],
        clear_image: true,
      });

    expect(res.status).toBe(200);
    // image_url present + existing cover, no replace_image -> neither fill nor
    // clear runs, so the cover is left untouched.
    expect(recordedUpdates).toHaveLength(0);
  });

  it("does not clear a cover that is already absent", async () => {
    pushDbResult([
      { id: 1, slug: "world-deserts", title: "World Deserts", imageUrl: null },
    ]); // course lookup -> existing, no cover
    pushExistingCourseStructure(minimalImportItem.question);

    const res = await request(app)
      .post("/api/courses/bulk-import")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        items: [minimalImportItem], // no image_url
        clear_image: true,
      });

    expect(res.status).toBe(200);
    // Nothing to clear -> no update issued.
    expect(recordedUpdates).toHaveLength(0);
  });
});

describe("POST /api/course-modules/:moduleId/attempts", () => {
  it("returns 400 for non-numeric moduleId", async () => {
    const res = await request(app)
      .post("/api/course-modules/abc/attempts")
      .send({ answers: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid body (missing answers)", async () => {
    const res = await request(app)
      .post("/api/course-modules/1/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 for anonymous users", async () => {
    const res = await request(app)
      .post("/api/course-modules/1/attempts")
      .send({ answers: [] });
    expect(res.status).toBe(401);
  });

  it("returns 404 when module does not exist", async () => {
    pushDbResult([]); // module lookup
    const res = await request(app)
      .post("/api/course-modules/9999/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ answers: [] });
    expect(res.status).toBe(404);
  });

  it("scores signed-in attempts and reports mastery threshold", async () => {
    // module lookup
    pushDbResult([{ id: 5, courseId: 1, slug: "m1", title: "M1", orderIndex: 0 }]);
    // allModules (only this module — no prev, no lock check)
    pushDbResult([{ id: 5, courseId: 1, slug: "m1", title: "M1", orderIndex: 0 }]);
    // lessons
    pushDbResult([{ id: 10 }]);
    // questions
    pushDbResult([
      {
        id: 100,
        lessonId: 10,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 101,
        lessonId: 10,
        text: "Q2",
        options: ["a", "b", "c", "d"],
        correctOption: 1,
        explanation: "ex",
        funFact: null,
      },
    ]);

    const res = await request(app)
      .post("/api/course-modules/5/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        answers: [
          { questionId: 100, selectedOption: 0 },
          { questionId: 101, selectedOption: 0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.totalQuestions).toBe(2);
    expect(res.body.percentage).toBe(50);
    expect(res.body.mastered).toBe(false);
    expect(res.body.masteryThreshold).toBe(80);
    expect(Array.isArray(res.body.questionResults)).toBe(true);
    expect(res.body.questionResults).toHaveLength(2);
  });

  it("marks attempt mastered when percentage >= 80", async () => {
    pushDbResult([{ id: 7, courseId: 1, slug: "m2", title: "M2", orderIndex: 1 }]);
    // allModules (only this module — no prev, no lock check)
    pushDbResult([{ id: 7, courseId: 1, slug: "m2", title: "M2", orderIndex: 1 }]);
    pushDbResult([{ id: 20 }]);
    pushDbResult([
      {
        id: 200,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 201,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 1,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 202,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 2,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 203,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 3,
        explanation: "ex",
        funFact: null,
      },
      {
        id: 204,
        lessonId: 20,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "ex",
        funFact: null,
      },
    ]);

    const res = await request(app)
      .post("/api/course-modules/7/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        answers: [
          { questionId: 200, selectedOption: 0 },
          { questionId: 201, selectedOption: 1 },
          { questionId: 202, selectedOption: 2 },
          { questionId: 203, selectedOption: 3 },
          { questionId: 204, selectedOption: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(4);
    expect(res.body.percentage).toBe(80);
    expect(res.body.mastered).toBe(true);
  });

  it("drops the in-progress save when a signed-in user finishes a module", async () => {
    // module lookup
    pushDbResult([{ id: 5, courseId: 1, slug: "m1", title: "M1", orderIndex: 0 }]);
    // allModules (only this module — no prev, no lock check)
    pushDbResult([{ id: 5, courseId: 1, slug: "m1", title: "M1", orderIndex: 0 }]);
    // lessons
    pushDbResult([{ id: 10 }]);
    // questions
    pushDbResult([
      {
        id: 100,
        lessonId: 10,
        text: "Q",
        options: ["a", "b", "c", "d"],
        correctOption: 0,
        explanation: "ex",
        funFact: null,
      },
    ]);

    const res = await request(app)
      .post("/api/course-modules/5/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ answers: [{ questionId: 100, selectedOption: 0 }] });

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
    // The attempt is recorded ...
    expect(recordedInserts).toHaveLength(1);
    // ... and the in-progress progress row for this module is cleared.
    expect(recordedDeletes).toContain(courseModuleProgressTable);
  });

  it("rejects an anonymous attempt without touching progress", async () => {
    const res = await request(app)
      .post("/api/course-modules/6/attempts")
      .send({ answers: [{ questionId: 110, selectedOption: 0 }] });

    // Anonymous users cannot submit, so nothing is persisted or cleared.
    expect(res.status).toBe(401);
    expect(recordedInserts).toHaveLength(0);
    expect(recordedDeletes).not.toContain(courseModuleProgressTable);
  });
});

describe("POST /api/course-modules/:moduleId/attempts — bypass protection", () => {
  it("ignores duplicate answers for the same question", async () => {
    pushDbResult([{ id: 8, courseId: 1, slug: "m3", title: "M3", orderIndex: 2 }]);
    // allModules (only this module — no prev, no lock check)
    pushDbResult([{ id: 8, courseId: 1, slug: "m3", title: "M3", orderIndex: 2 }]);
    pushDbResult([{ id: 30 }]);
    pushDbResult([
      { id: 300, lessonId: 30, text: "Q", options: ["a", "b", "c", "d"], correctOption: 0, explanation: "ex", funFact: null },
      { id: 301, lessonId: 30, text: "Q", options: ["a", "b", "c", "d"], correctOption: 1, explanation: "ex", funFact: null },
      { id: 302, lessonId: 30, text: "Q", options: ["a", "b", "c", "d"], correctOption: 2, explanation: "ex", funFact: null },
    ]);

    // Submitting the SAME correct answer 5 times for question 300 should NOT
    // give the user 5/5 — duplicates are deduped, unanswered questions count wrong.
    const res = await request(app)
      .post("/api/course-modules/8/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        answers: [
          { questionId: 300, selectedOption: 0 },
          { questionId: 300, selectedOption: 0 },
          { questionId: 300, selectedOption: 0 },
          { questionId: 300, selectedOption: 0 },
          { questionId: 300, selectedOption: 0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.totalQuestions).toBe(3);
    expect(res.body.score).toBe(1);
    expect(res.body.percentage).toBe(33);
    expect(res.body.mastered).toBe(false);
  });

  it("ignores answers for unknown questionIds and partial submissions count as wrong", async () => {
    pushDbResult([{ id: 9, courseId: 1, slug: "m4", title: "M4", orderIndex: 3 }]);
    // allModules (only this module — no prev, no lock check)
    pushDbResult([{ id: 9, courseId: 1, slug: "m4", title: "M4", orderIndex: 3 }]);
    pushDbResult([{ id: 40 }]);
    pushDbResult([
      { id: 400, lessonId: 40, text: "Q", options: ["a", "b", "c", "d"], correctOption: 0, explanation: "ex", funFact: null },
      { id: 401, lessonId: 40, text: "Q", options: ["a", "b", "c", "d"], correctOption: 0, explanation: "ex", funFact: null },
    ]);

    const res = await request(app)
      .post("/api/course-modules/9/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({
        answers: [
          { questionId: 400, selectedOption: 0 },
          { questionId: 99999, selectedOption: 0 }, // unknown id
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.totalQuestions).toBe(2); // both module questions counted
    expect(res.body.score).toBe(1);
    expect(res.body.percentage).toBe(50);
    expect(res.body.mastered).toBe(false);
    // questionResults should reflect both module questions (one answered, one not)
    expect(res.body.questionResults).toHaveLength(2);
    const unanswered = res.body.questionResults.find((r: { questionId: number }) => r.questionId === 401);
    expect(unanswered.isCorrect).toBe(false);
    expect(unanswered.selectedOption).toBe(-1);
  });
});

describe("POST /api/course-modules/:moduleId/attempts — lock enforcement", () => {
  it("returns 403 when the previous module has not been mastered", async () => {
    // module lookup — module 12 is the second in course 2
    pushDbResult([{ id: 12, courseId: 2, slug: "mod-2", title: "Mod 2", orderIndex: 1 }]);
    // allModules — two modules, so module 12 has a predecessor (module 11)
    pushDbResult([
      { id: 11, courseId: 2, slug: "mod-1", title: "Mod 1", orderIndex: 0 },
      { id: 12, courseId: 2, slug: "mod-2", title: "Mod 2", orderIndex: 1 },
    ]);
    // getModuleStatsForUser for prevMod (11) — no attempts yet, not mastered
    pushDbResult([]);

    const res = await request(app)
      .post("/api/course-modules/12/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ answers: [] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/locked/i);
    expect(res.body.previousModuleSlug).toBe("mod-1");
  });

  it("allows attempt when the previous module has been mastered", async () => {
    // module lookup — module 22 is the second in course 3
    pushDbResult([{ id: 22, courseId: 3, slug: "mod-b", title: "Mod B", orderIndex: 1 }]);
    // allModules — two modules
    pushDbResult([
      { id: 21, courseId: 3, slug: "mod-a", title: "Mod A", orderIndex: 0 },
      { id: 22, courseId: 3, slug: "mod-b", title: "Mod B", orderIndex: 1 },
    ]);
    // getModuleStatsForUser for prevMod (21) — mastered (bestPercentage >= 80)
    pushDbResult([{ moduleId: 21, attempts: 1, bestPercentage: 100 }]);
    // lessons
    pushDbResult([{ id: 50 }]);
    // questions — 1 question
    pushDbResult([
      { id: 500, lessonId: 50, text: "Q", options: ["a", "b", "c", "d"], correctOption: 0, explanation: "ex", funFact: null },
    ]);
    // getModuleStatsForUser for current mod (previouslyMastered check) — empty
    pushDbResult([]);

    const res = await request(app)
      .post("/api/course-modules/22/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ answers: [{ questionId: 500, selectedOption: 0 }] });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.totalQuestions).toBe(1);
    expect(res.body.percentage).toBe(100);
    expect(res.body.mastered).toBe(true);
  });

  it("allows attempt for the first module in a course (no lock)", async () => {
    // module lookup — module 31 is the only module in course 4
    pushDbResult([{ id: 31, courseId: 4, slug: "first-mod", title: "First", orderIndex: 0 }]);
    // allModules — only one module, no previous
    pushDbResult([{ id: 31, courseId: 4, slug: "first-mod", title: "First", orderIndex: 0 }]);
    // lessons
    pushDbResult([{ id: 60 }]);
    // questions
    pushDbResult([
      { id: 600, lessonId: 60, text: "Q", options: ["a", "b", "c", "d"], correctOption: 2, explanation: "ex", funFact: null },
    ]);
    // getModuleStatsForUser for current mod (previouslyMastered check)
    pushDbResult([]);

    const res = await request(app)
      .post("/api/course-modules/31/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ answers: [{ questionId: 600, selectedOption: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.mastered).toBe(true);
  });
});

describe("GET /api/courses", () => {
  it("allows anonymous users (returns empty list when no courses)", async () => {
    pushDbResult([]); // courses
    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("returns an empty array when no courses exist (signed-in)", async () => {
    pushDbResult([]); // courses
    pushDbResult([]); // module counts
    const res = await request(app)
      .get("/api/courses")
      .set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });
});

describe("GET /api/admin/courses/:slug", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/admin/courses/world-deserts");
    expect(res.status).toBe(401);
  });

  it("rejects non-admin users with 403", async () => {
    const res = await request(app)
      .get("/api/admin/courses/world-deserts")
      .set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(403);
  });

  it("returns 404 when course does not exist", async () => {
    pushDbResult([]); // course lookup
    const res = await request(app)
      .get("/api/admin/courses/missing")
      .set("x-test-user-id", ADMIN_ID);
    expect(res.status).toBe(404);
  });

  it("returns nested modules, lessons, and questions for admins", async () => {
    pushDbResult([{ id: 1, slug: "world-deserts", title: "World Deserts", description: "All deserts" }]); // course
    pushDbResult([
      { id: 5, courseId: 1, slug: "m1", title: "Module 1", description: "Intro", orderIndex: 0 },
    ]); // modules
    pushDbResult([{ id: 10, moduleId: 5, slug: "l1", title: "Lesson 1", orderIndex: 0 }]); // lessons
    pushDbResult([
      {
        id: 100,
        lessonId: 10,
        text: "Largest hot desert?",
        options: ["Sahara", "Gobi", "Atacama", "Kalahari"],
        correctOption: 0,
        explanation: "Sahara is largest.",
        funFact: null,
        learningObjective: null,
        difficulty: "Easy",
        questionType: null,
        orderIndex: 0,
      },
    ]); // questions
    const res = await request(app)
      .get("/api/admin/courses/world-deserts")
      .set("x-test-user-id", ADMIN_ID);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("world-deserts");
    expect(res.body.modules).toHaveLength(1);
    expect(res.body.modules[0].lessons).toHaveLength(1);
    expect(res.body.modules[0].lessons[0].questions).toHaveLength(1);
    expect(res.body.modules[0].lessons[0].questions[0].correctOption).toBe(0);
  });
});

describe("PATCH /api/course-questions/:id", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .patch("/api/course-questions/100")
      .send({ text: "Updated" });
    expect(res.status).toBe(401);
  });

  it("rejects non-admin users with 403", async () => {
    const res = await request(app)
      .patch("/api/course-questions/100")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ text: "Updated" });
    expect(res.status).toBe(403);
  });

  it("returns 404 when question does not exist", async () => {
    pushDbResult([]); // update returning -> empty
    const res = await request(app)
      .patch("/api/course-questions/999")
      .set("x-test-user-id", ADMIN_ID)
      .send({ text: "Updated" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for an out-of-range correctOption", async () => {
    const res = await request(app)
      .patch("/api/course-questions/100")
      .set("x-test-user-id", ADMIN_ID)
      .send({ correctOption: 9 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when options is not exactly 4 entries", async () => {
    const res = await request(app)
      .patch("/api/course-questions/100")
      .set("x-test-user-id", ADMIN_ID)
      .send({ options: ["A", "B"] });
    expect(res.status).toBe(400);
  });

  it("returns the existing question for an empty body (no fields to update)", async () => {
    pushDbResult([
      {
        id: 100,
        lessonId: 10,
        text: "Unchanged?",
        options: ["A", "B", "C", "D"],
        correctOption: 1,
        explanation: "Stable.",
        funFact: null,
        learningObjective: null,
        difficulty: null,
        questionType: null,
        orderIndex: 0,
      },
    ]); // select fallback
    const res = await request(app)
      .patch("/api/course-questions/100")
      .set("x-test-user-id", ADMIN_ID)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(100);
    expect(res.body.text).toBe("Unchanged?");
  });

  it("updates a course question for admins", async () => {
    pushDbResult([
      {
        id: 100,
        lessonId: 10,
        text: "Updated question?",
        options: ["A", "B", "C", "D"],
        correctOption: 2,
        explanation: "Because C.",
        funFact: "Neat.",
        learningObjective: null,
        difficulty: "Medium",
        questionType: null,
        orderIndex: 0,
      },
    ]); // update returning
    const res = await request(app)
      .patch("/api/course-questions/100")
      .set("x-test-user-id", ADMIN_ID)
      .send({ text: "Updated question?", correctOption: 2, funFact: "Neat." });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(100);
    expect(res.body.text).toBe("Updated question?");
    expect(res.body.correctOption).toBe(2);
    expect(res.body.funFact).toBe("Neat.");
  });
});

describe("course id-bearing endpoints reject a non-numeric id with 400", () => {
  it("GET /api/course-modules/:moduleId/progress 400s a non-numeric id without reading the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await request(app)
      .get("/api/course-modules/abc/progress")
      .set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(400);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });

  it("PUT /api/course-modules/:moduleId/progress 400s a non-numeric id without reading or writing the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await request(app)
      .put("/api/course-modules/abc/progress")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ answers: [] });
    expect(res.status).toBe(400);
    expect(recordedUpdates).toHaveLength(0);
    expect(recordedInserts).toHaveLength(0);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });

  it("DELETE /api/course-modules/:moduleId/progress 400s a non-numeric id without deleting from the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await request(app)
      .delete("/api/course-modules/abc/progress")
      .set("x-test-user-id", NON_ADMIN_ID);
    expect(res.status).toBe(400);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });

  it("POST /api/course-modules/:moduleId/attempts 400s a non-numeric id without reading or writing the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await request(app)
      .post("/api/course-modules/abc/attempts")
      .set("x-test-user-id", NON_ADMIN_ID)
      .send({ answers: [] });
    expect(res.status).toBe(400);
    expect(recordedInserts).toHaveLength(0);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });

  it("PATCH /api/course-questions/:id 400s a non-numeric id (as admin) without reading or writing the DB", async () => {
    pushDbResult([{ id: 1 }]);

    const res = await request(app)
      .patch("/api/course-questions/abc")
      .set("x-test-user-id", ADMIN_ID)
      .send({ text: "Updated?" });
    expect(res.status).toBe(400);
    expect(recordedUpdates).toHaveLength(0);
    expect(dbResultQueue).toHaveLength(1); // queued result was never consumed
  });
});

describe("course-module progress save/resume happy paths", () => {
  const SAVED_AT = new Date("2026-02-01T12:00:00.000Z");
  const SAVED_ANSWERS = [
    { questionId: 100, selectedOption: 0 },
    { questionId: 101, selectedOption: 2 },
  ];

  describe("GET /api/course-modules/:moduleId/progress", () => {
    it("returns previously saved answers for the signed-in user", async () => {
      pushDbResult([
        { moduleId: 5, answers: SAVED_ANSWERS, updatedAt: SAVED_AT },
      ]);

      const res = await request(app)
        .get("/api/course-modules/5/progress")
        .set("x-test-user-id", NON_ADMIN_ID);

      expect(res.status).toBe(200);
      expect(res.body.moduleId).toBe(5);
      expect(res.body.answers).toEqual(SAVED_ANSWERS);
      expect(res.body.updatedAt).toBe(SAVED_AT.toISOString());
    });

    it("returns null when no progress has been saved", async () => {
      pushDbResult([]); // no saved row

      const res = await request(app)
        .get("/api/course-modules/5/progress")
        .set("x-test-user-id", NON_ADMIN_ID);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it("returns 401 for anonymous users", async () => {
      const res = await request(app).get("/api/course-modules/5/progress");
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/course-modules/:moduleId/progress", () => {
    it("saves in-progress answers and returns them back", async () => {
      pushDbResult([{ id: 5, courseId: 1, slug: "m1", title: "M1", orderIndex: 0 }]); // loadModuleById
      pushDbResult([
        { moduleId: 5, answers: SAVED_ANSWERS, updatedAt: SAVED_AT },
      ]); // upsert returning

      const res = await request(app)
        .put("/api/course-modules/5/progress")
        .set("x-test-user-id", NON_ADMIN_ID)
        .send({ answers: SAVED_ANSWERS });

      expect(res.status).toBe(200);
      expect(res.body.moduleId).toBe(5);
      expect(res.body.answers).toEqual(SAVED_ANSWERS);
      expect(res.body.updatedAt).toBe(SAVED_AT.toISOString());
      // The upsert writes the user's answers scoped to their own id + module.
      expect(recordedInserts).toHaveLength(1);
      expect(recordedInserts[0]).toEqual({
        moduleId: 5,
        userId: NON_ADMIN_ID,
        answers: SAVED_ANSWERS,
      });
    });

    it("returns 404 when the module does not exist", async () => {
      pushDbResult([]); // loadModuleById -> none

      const res = await request(app)
        .put("/api/course-modules/9999/progress")
        .set("x-test-user-id", NON_ADMIN_ID)
        .send({ answers: SAVED_ANSWERS });

      expect(res.status).toBe(404);
      expect(recordedInserts).toHaveLength(0);
    });

    it("returns 401 for anonymous users without writing to the DB", async () => {
      const res = await request(app)
        .put("/api/course-modules/5/progress")
        .send({ answers: SAVED_ANSWERS });

      expect(res.status).toBe(401);
      expect(recordedInserts).toHaveLength(0);
    });
  });

  describe("DELETE /api/course-modules/:moduleId/progress", () => {
    it("clears saved progress for the signed-in user", async () => {
      const res = await request(app)
        .delete("/api/course-modules/5/progress")
        .set("x-test-user-id", NON_ADMIN_ID);

      expect(res.status).toBe(200);
      expect(res.body.saved).toBe(true);
    });

    it("returns 401 for anonymous users", async () => {
      const res = await request(app).delete("/api/course-modules/5/progress");
      expect(res.status).toBe(401);
    });
  });
});
