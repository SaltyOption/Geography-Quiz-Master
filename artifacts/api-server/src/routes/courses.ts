import { Router, type IRouter } from "express";
import { eq, sql, inArray, asc, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  coursesTable,
  courseModulesTable,
  courseLessonsTable,
  courseQuestionsTable,
  courseModuleAttemptsTable,
  courseModuleProgressTable,
} from "@workspace/db";
import {
  SubmitCourseModuleAttemptBody,
  BulkImportCourseBody,
  SaveCourseModuleProgressBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

export const COURSE_MASTERY_THRESHOLD = 80;

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "item"
  );
}

async function uniqueCourseSlug(base: string): Promise<string> {
  const baseSlug = slugify(base);
  let candidate = baseSlug;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [existing] = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${baseSlug}-${n++}`;
  }
}

type ModuleAttemptStats = {
  attempts: number;
  bestPercentage: number;
  mastered: boolean;
};

async function getModuleProgressForUser(
  moduleIds: number[],
  userId: string,
): Promise<Set<number>> {
  const set = new Set<number>();
  if (moduleIds.length === 0) return set;
  const rows = await db
    .select({ moduleId: courseModuleProgressTable.moduleId })
    .from(courseModuleProgressTable)
    .where(
      and(
        eq(courseModuleProgressTable.userId, userId),
        inArray(courseModuleProgressTable.moduleId, moduleIds),
      ),
    );
  for (const r of rows) set.add(r.moduleId);
  return set;
}

async function getModuleStatsForUser(
  moduleIds: number[],
  userId: string,
): Promise<Map<number, ModuleAttemptStats>> {
  const map = new Map<number, ModuleAttemptStats>();
  if (moduleIds.length === 0) return map;
  const rows = await db
    .select({
      moduleId: courseModuleAttemptsTable.moduleId,
      attempts: sql<number>`count(*)::int`,
      bestPercentage: sql<number>`coalesce(max(${courseModuleAttemptsTable.percentage}), 0)::int`,
    })
    .from(courseModuleAttemptsTable)
    .where(
      and(
        eq(courseModuleAttemptsTable.userId, userId),
        inArray(courseModuleAttemptsTable.moduleId, moduleIds),
      ),
    )
    .groupBy(courseModuleAttemptsTable.moduleId);
  for (const r of rows) {
    map.set(r.moduleId, {
      attempts: r.attempts,
      bestPercentage: r.bestPercentage,
      mastered: r.bestPercentage >= COURSE_MASTERY_THRESHOLD,
    });
  }
  return map;
}

router.get("/courses", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access courses" });
    return;
  }

  const courses = await db
    .select()
    .from(coursesTable)
    .orderBy(asc(coursesTable.orderIndex), asc(coursesTable.title));

  if (courses.length === 0) {
    res.json([]);
    return;
  }

  const courseIds = courses.map((c) => c.id);
  const modules = await db
    .select()
    .from(courseModulesTable)
    .where(inArray(courseModulesTable.courseId, courseIds));

  const moduleCountByCourse = new Map<number, number>();
  for (const m of modules) {
    moduleCountByCourse.set(m.courseId, (moduleCountByCourse.get(m.courseId) ?? 0) + 1);
  }

  let masteredByCourse = new Map<number, number>();
  if (userId && modules.length > 0) {
    const stats = await getModuleStatsForUser(
      modules.map((m) => m.id),
      userId,
    );
    const moduleToCourse = new Map(modules.map((m) => [m.id, m.courseId]));
    for (const [moduleId, s] of stats) {
      if (!s.mastered) continue;
      const courseId = moduleToCourse.get(moduleId);
      if (courseId === undefined) continue;
      masteredByCourse.set(courseId, (masteredByCourse.get(courseId) ?? 0) + 1);
    }
  }

  res.json(
    courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      imageUrl: c.imageUrl,
      moduleCount: moduleCountByCourse.get(c.id) ?? 0,
      masteredCount: masteredByCourse.get(c.id) ?? 0,
    })),
  );
});

router.get("/courses/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access courses" });
    return;
  }

  const [course] = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.slug, slug))
    .limit(1);
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const modules = await db
    .select()
    .from(courseModulesTable)
    .where(eq(courseModulesTable.courseId, course.id))
    .orderBy(asc(courseModulesTable.orderIndex), asc(courseModulesTable.id));

  const moduleIds = modules.map((m) => m.id);

  const questionCounts = new Map<number, number>();
  const lessonCounts = new Map<number, number>();
  if (moduleIds.length > 0) {
    const lessons = await db
      .select({ id: courseLessonsTable.id, moduleId: courseLessonsTable.moduleId })
      .from(courseLessonsTable)
      .where(inArray(courseLessonsTable.moduleId, moduleIds));
    for (const l of lessons) {
      lessonCounts.set(l.moduleId, (lessonCounts.get(l.moduleId) ?? 0) + 1);
    }
    if (lessons.length > 0) {
      const lessonIds = lessons.map((l) => l.id);
      const lessonToModule = new Map(lessons.map((l) => [l.id, l.moduleId]));
      const qRows = await db
        .select({ lessonId: courseQuestionsTable.lessonId, count: sql<number>`count(*)::int` })
        .from(courseQuestionsTable)
        .where(inArray(courseQuestionsTable.lessonId, lessonIds))
        .groupBy(courseQuestionsTable.lessonId);
      for (const r of qRows) {
        const mid = lessonToModule.get(r.lessonId);
        if (mid === undefined) continue;
        questionCounts.set(mid, (questionCounts.get(mid) ?? 0) + r.count);
      }
    }
  }

  const stats = userId
    ? await getModuleStatsForUser(moduleIds, userId)
    : new Map<number, ModuleAttemptStats>();
  const progressSet = userId
    ? await getModuleProgressForUser(moduleIds, userId)
    : new Set<number>();

  const moduleSummaries = modules.map((m, idx) => {
    const s = stats.get(m.id);
    let locked = false;
    if (userId && idx > 0) {
      const prev = modules[idx - 1];
      const prevStats = stats.get(prev.id);
      locked = !(prevStats && prevStats.mastered);
    }
    return {
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      orderIndex: m.orderIndex,
      questionCount: questionCounts.get(m.id) ?? 0,
      lessonCount: lessonCounts.get(m.id) ?? 0,
      locked,
      attempts: s?.attempts ?? 0,
      bestPercentage: s?.bestPercentage ?? 0,
      mastered: s?.mastered ?? false,
      inProgress: progressSet.has(m.id),
    };
  });

  res.json({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    imageUrl: course.imageUrl,
    masteryThreshold: COURSE_MASTERY_THRESHOLD,
    modules: moduleSummaries,
  });
});

router.get("/courses/:slug/modules/:moduleSlug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const moduleSlug = String(req.params.moduleSlug);
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access courses" });
    return;
  }

  const [course] = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.slug, slug))
    .limit(1);
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const allModules = await db
    .select()
    .from(courseModulesTable)
    .where(eq(courseModulesTable.courseId, course.id))
    .orderBy(asc(courseModulesTable.orderIndex), asc(courseModulesTable.id));

  const idx = allModules.findIndex((m) => m.slug === moduleSlug);
  if (idx < 0) {
    res.status(404).json({ error: "Module not found" });
    return;
  }
  const mod = allModules[idx];
  const prevMod = idx > 0 ? allModules[idx - 1] : null;
  const nextMod = idx + 1 < allModules.length ? allModules[idx + 1] : null;

  const stats = userId
    ? await getModuleStatsForUser(
        allModules.map((m) => m.id),
        userId,
      )
    : new Map<number, ModuleAttemptStats>();

  if (userId && prevMod) {
    const prevStats = stats.get(prevMod.id);
    if (!(prevStats && prevStats.mastered)) {
      res.status(403).json({
        error: "Module is locked. Master the previous module first.",
        previousModuleSlug: prevMod.slug,
      });
      return;
    }
  }

  const lessons = await db
    .select()
    .from(courseLessonsTable)
    .where(eq(courseLessonsTable.moduleId, mod.id))
    .orderBy(asc(courseLessonsTable.orderIndex), asc(courseLessonsTable.id));

  const lessonIds = lessons.map((l) => l.id);
  const questions =
    lessonIds.length > 0
      ? await db
          .select()
          .from(courseQuestionsTable)
          .where(inArray(courseQuestionsTable.lessonId, lessonIds))
          .orderBy(asc(courseQuestionsTable.orderIndex), asc(courseQuestionsTable.id))
      : [];

  const qByLesson = new Map<number, typeof questions>();
  for (const q of questions) {
    const arr = qByLesson.get(q.lessonId) ?? [];
    arr.push(q);
    qByLesson.set(q.lessonId, arr);
  }

  const lessonsOut = lessons.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    orderIndex: l.orderIndex,
    questions: (qByLesson.get(l.id) ?? []).map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correctOption: q.correctOption,
      explanation: q.explanation,
      funFact: q.funFact ?? null,
      learningObjective: q.learningObjective ?? null,
      difficulty: q.difficulty ?? null,
      questionType: q.questionType ?? null,
      orderIndex: q.orderIndex,
    })),
  }));

  function summariseModule(
    m: typeof allModules[number],
    moduleIdx: number,
  ) {
    const s = stats.get(m.id);
    let locked = false;
    if (userId && moduleIdx > 0) {
      const prev = allModules[moduleIdx - 1];
      const prevStats = stats.get(prev.id);
      locked = !(prevStats && prevStats.mastered);
    }
    return {
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      orderIndex: m.orderIndex,
      questionCount: 0,
      lessonCount: 0,
      locked,
      attempts: s?.attempts ?? 0,
      bestPercentage: s?.bestPercentage ?? 0,
      mastered: s?.mastered ?? false,
      inProgress: false,
    };
  }

  const myStats = stats.get(mod.id);

  // Load any saved in-progress answers for this module (signed-in users only).
  let progress: {
    moduleId: number;
    answers: Array<{ questionId: number; selectedOption: number }>;
    updatedAt: string;
  } | null = null;
  if (userId) {
    const [row] = await db
      .select()
      .from(courseModuleProgressTable)
      .where(
        and(
          eq(courseModuleProgressTable.userId, userId),
          eq(courseModuleProgressTable.moduleId, mod.id),
        ),
      )
      .limit(1);
    if (row) {
      progress = {
        moduleId: mod.id,
        answers: row.answers as Array<{ questionId: number; selectedOption: number }>,
        updatedAt: row.updatedAt.toISOString(),
      };
    }
  }

  res.json({
    id: mod.id,
    slug: mod.slug,
    title: mod.title,
    description: mod.description,
    orderIndex: mod.orderIndex,
    courseSlug: course.slug,
    courseTitle: course.title,
    masteryThreshold: COURSE_MASTERY_THRESHOLD,
    previousModule: prevMod ? summariseModule(prevMod, idx - 1) : null,
    nextModule: nextMod ? summariseModule(nextMod, idx + 1) : null,
    bestPercentage: myStats?.bestPercentage ?? 0,
    attempts: myStats?.attempts ?? 0,
    mastered: myStats?.mastered ?? false,
    progress,
    lessons: lessonsOut,
  });
});

// Helper: load module by id (used by progress endpoints below).
async function loadModuleById(moduleId: number) {
  const [mod] = await db
    .select()
    .from(courseModulesTable)
    .where(eq(courseModulesTable.id, moduleId))
    .limit(1);
  return mod ?? null;
}

router.get("/course-modules/:moduleId/progress", async (req, res): Promise<void> => {
  const moduleId = Number(req.params.moduleId);
  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    res.status(400).json({ error: "Invalid moduleId" });
    return;
  }
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access courses" });
    return;
  }
  const [row] = await db
    .select()
    .from(courseModuleProgressTable)
    .where(
      and(
        eq(courseModuleProgressTable.userId, userId),
        eq(courseModuleProgressTable.moduleId, moduleId),
      ),
    )
    .limit(1);
  if (!row) {
    res.json(null);
    return;
  }
  res.json({
    moduleId: row.moduleId,
    answers: row.answers,
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.put("/course-modules/:moduleId/progress", async (req, res): Promise<void> => {
  const moduleId = Number(req.params.moduleId);
  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    res.status(400).json({ error: "Invalid moduleId" });
    return;
  }
  const parsed = SaveCourseModuleProgressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access courses" });
    return;
  }
  const mod = await loadModuleById(moduleId);
  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }
  const answers = parsed.data.answers;
  const [row] = await db
    .insert(courseModuleProgressTable)
    .values({ moduleId, userId, answers })
    .onConflictDoUpdate({
      target: [courseModuleProgressTable.userId, courseModuleProgressTable.moduleId],
      set: { answers, updatedAt: new Date() },
    })
    .returning();
  res.json({
    moduleId: row.moduleId,
    answers: row.answers,
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.delete("/course-modules/:moduleId/progress", async (req, res): Promise<void> => {
  const moduleId = Number(req.params.moduleId);
  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    res.status(400).json({ error: "Invalid moduleId" });
    return;
  }
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access courses" });
    return;
  }
  await db
    .delete(courseModuleProgressTable)
    .where(
      and(
        eq(courseModuleProgressTable.userId, userId),
        eq(courseModuleProgressTable.moduleId, moduleId),
      ),
    );
  res.json({ saved: true });
});

router.post("/course-modules/:moduleId/attempts", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.moduleId) ? req.params.moduleId[0] : req.params.moduleId;
  const moduleId = Number(rawId);
  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    res.status(400).json({ error: "Invalid moduleId" });
    return;
  }
  const parsed = SubmitCourseModuleAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { answers } = parsed.data;
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to submit module attempts" });
    return;
  }

  const [mod] = await db
    .select()
    .from(courseModulesTable)
    .where(eq(courseModulesTable.id, moduleId))
    .limit(1);
  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const lessons = await db
    .select({ id: courseLessonsTable.id })
    .from(courseLessonsTable)
    .where(eq(courseLessonsTable.moduleId, mod.id));
  const lessonIds = lessons.map((l) => l.id);
  const questions =
    lessonIds.length > 0
      ? await db
          .select()
          .from(courseQuestionsTable)
          .where(inArray(courseQuestionsTable.lessonId, lessonIds))
      : [];

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Dedupe answers by questionId (last write wins) and ignore unknown ids.
  // This prevents mastery bypass via duplicate or partial submissions.
  const answersById = new Map<number, number>();
  for (const a of answers) {
    if (questionMap.has(a.questionId)) {
      answersById.set(a.questionId, a.selectedOption);
    }
  }

  // Score against the full set of module questions — unanswered questions
  // count as incorrect, so partial submissions cannot inflate the percentage.
  const totalQuestions = questions.length;
  let score = 0;
  const questionResults = questions.map((q) => {
    const selected = answersById.get(q.id);
    const answered = selected !== undefined;
    const isCorrect = answered && selected === q.correctOption;
    if (isCorrect) score++;
    return {
      questionId: q.id,
      isCorrect,
      selectedOption: answered ? selected! : -1,
      correctOption: q.correctOption,
      explanation: q.explanation,
      funFact: q.funFact ?? null,
    };
  });

  const percentage =
    totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const mastered = percentage >= COURSE_MASTERY_THRESHOLD;

  let previouslyMastered = false;
  if (userId) {
    const stats = await getModuleStatsForUser([mod.id], userId);
    previouslyMastered = stats.get(mod.id)?.mastered ?? false;

    await db.insert(courseModuleAttemptsTable).values({
      moduleId: mod.id,
      userId,
      score,
      totalQuestions,
      percentage,
      mastered,
      answers: answers,
    });

    // The user has finished this module — drop any in-progress save.
    await db
      .delete(courseModuleProgressTable)
      .where(
        and(
          eq(courseModuleProgressTable.userId, userId),
          eq(courseModuleProgressTable.moduleId, mod.id),
        ),
      );
  }

  res.json({
    moduleId: mod.id,
    score,
    totalQuestions,
    percentage,
    masteryThreshold: COURSE_MASTERY_THRESHOLD,
    mastered,
    previouslyMastered,
    saved: userId !== null,
    questionResults,
  });
});

router.post("/courses/bulk-import", requireAdmin, async (req, res): Promise<void> => {
  const body = Array.isArray(req.body) ? { items: req.body } : req.body;
  const parsed = BulkImportCourseBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { items } = parsed.data;
  if (items.length === 0) {
    res.status(400).json({ error: "No items provided" });
    return;
  }

  // Group by topic (course), then module, then lesson - preserving first-seen order.
  type ItemT = (typeof items)[number];
  const byTopic = new Map<string, Map<string, Map<string, ItemT[]>>>();
  for (const item of items) {
    const topic = item.topic.trim();
    const moduleName = item.module.trim();
    const lessonName = item.lesson.trim();
    if (!topic || !moduleName || !lessonName) continue;
    if (!byTopic.has(topic)) byTopic.set(topic, new Map());
    const modules = byTopic.get(topic)!;
    if (!modules.has(moduleName)) modules.set(moduleName, new Map());
    const lessonsMap = modules.get(moduleName)!;
    if (!lessonsMap.has(lessonName)) lessonsMap.set(lessonName, []);
    lessonsMap.get(lessonName)!.push(item);
  }

  if (byTopic.size === 0) {
    res.status(400).json({ error: "No valid items provided" });
    return;
  }

  if (byTopic.size > 1) {
    res.status(400).json({ error: "Bulk import expects a single topic per request" });
    return;
  }

  const [topic, modulesMap] = [...byTopic][0];

  try {
    const summary = await db.transaction(async (tx) => {
      // Find or create the course (by exact title).
      const [existingCourse] = await tx
        .select()
        .from(coursesTable)
        .where(eq(coursesTable.title, topic))
        .limit(1);

      let courseId: number;
      let courseSlug: string;
      let courseCreated = false;
      if (existingCourse) {
        courseId = existingCourse.id;
        courseSlug = existingCourse.slug;
      } else {
        const newSlug = await uniqueCourseSlug(topic);
        const [inserted] = await tx
          .insert(coursesTable)
          .values({
            title: topic,
            slug: newSlug,
            description: `A course on ${topic}`,
          })
          .returning();
        courseId = inserted.id;
        courseSlug = inserted.slug;
        courseCreated = true;
      }

      let modulesCreated = 0;
      let lessonsAdded = 0;
      let questionsAdded = 0;
      const modulesOut: Array<{
        title: string;
        slug: string;
        created: boolean;
        questionsAdded: number;
        lessonsAdded: number;
      }> = [];

      // Determine starting module orderIndex.
      const [maxModuleRow] = await tx
        .select({ max: sql<number | null>`max(${courseModulesTable.orderIndex})` })
        .from(courseModulesTable)
        .where(eq(courseModulesTable.courseId, courseId));
      let nextModuleOrder = (maxModuleRow?.max ?? -1) + 1;

      for (const [moduleTitle, lessonsMap] of modulesMap) {
        const moduleSlug = slugify(moduleTitle);
        const [existingModule] = await tx
          .select()
          .from(courseModulesTable)
          .where(
            and(
              eq(courseModulesTable.courseId, courseId),
              eq(courseModulesTable.slug, moduleSlug),
            ),
          )
          .limit(1);

        let moduleId: number;
        let moduleCreated = false;
        if (existingModule) {
          moduleId = existingModule.id;
        } else {
          const [insertedModule] = await tx
            .insert(courseModulesTable)
            .values({
              courseId,
              title: moduleTitle,
              slug: moduleSlug,
              orderIndex: nextModuleOrder++,
            })
            .returning();
          moduleId = insertedModule.id;
          moduleCreated = true;
          modulesCreated += 1;
        }

        let moduleLessonsAdded = 0;
        let moduleQuestionsAdded = 0;

        const [maxLessonRow] = await tx
          .select({ max: sql<number | null>`max(${courseLessonsTable.orderIndex})` })
          .from(courseLessonsTable)
          .where(eq(courseLessonsTable.moduleId, moduleId));
        let nextLessonOrder = (maxLessonRow?.max ?? -1) + 1;

        for (const [lessonTitle, lessonItems] of lessonsMap) {
          const lessonSlug = slugify(lessonTitle);
          const [existingLesson] = await tx
            .select()
            .from(courseLessonsTable)
            .where(
              and(
                eq(courseLessonsTable.moduleId, moduleId),
                eq(courseLessonsTable.slug, lessonSlug),
              ),
            )
            .limit(1);

          let lessonId: number;
          if (existingLesson) {
            lessonId = existingLesson.id;
          } else {
            const [insertedLesson] = await tx
              .insert(courseLessonsTable)
              .values({
                moduleId,
                title: lessonTitle,
                slug: lessonSlug,
                orderIndex: nextLessonOrder++,
              })
              .returning();
            lessonId = insertedLesson.id;
            moduleLessonsAdded += 1;
            lessonsAdded += 1;
          }

          const [maxQ] = await tx
            .select({ max: sql<number | null>`max(${courseQuestionsTable.orderIndex})` })
            .from(courseQuestionsTable)
            .where(eq(courseQuestionsTable.lessonId, lessonId));
          let nextQOrder = (maxQ?.max ?? -1) + 1;

          // Idempotency: skip questions whose normalized text already exists
          // in this lesson, so re-importing the same JSON is a no-op.
          const existingQuestions = await tx
            .select({ text: courseQuestionsTable.text })
            .from(courseQuestionsTable)
            .where(eq(courseQuestionsTable.lessonId, lessonId));
          const normalize = (s: string): string =>
            s.trim().toLowerCase().replace(/\s+/g, " ");
          const existingTexts = new Set(existingQuestions.map((q) => normalize(q.text)));
          const seenInBatch = new Set<string>();

          const rows: Array<{
            lessonId: number;
            text: string;
            options: string[];
            correctOption: number;
            explanation: string;
            funFact: string | null;
            learningObjective: string | null;
            difficulty: string | null;
            questionType: string | null;
            masteryWeight: number;
            orderIndex: number;
          }> = [];
          for (const item of lessonItems) {
            const key = normalize(item.question);
            if (existingTexts.has(key) || seenInBatch.has(key)) continue;
            seenInBatch.add(key);
            const opts = [item.options.A, item.options.B, item.options.C, item.options.D];
            const correctIndex = ["A", "B", "C", "D"].indexOf(item.correct_answer);
            rows.push({
              lessonId,
              text: item.question,
              options: opts,
              correctOption: correctIndex,
              explanation: item.explanation,
              funFact: item.fun_fact ?? null,
              learningObjective: item.learning_objective ?? null,
              difficulty: item.difficulty ?? null,
              questionType: item.question_type ?? null,
              masteryWeight: item.mastery_weight ?? 1,
              orderIndex: nextQOrder++,
            });
          }
          if (rows.length > 0) {
            await tx.insert(courseQuestionsTable).values(rows);
            moduleQuestionsAdded += rows.length;
            questionsAdded += rows.length;
          }
        }

        modulesOut.push({
          title: moduleTitle,
          slug: moduleSlug,
          created: moduleCreated,
          lessonsAdded: moduleLessonsAdded,
          questionsAdded: moduleQuestionsAdded,
        });
      }

      return {
        courseId,
        courseSlug,
        courseTitle: topic,
        courseCreated,
        modulesCreated,
        lessonsAdded,
        questionsAdded,
        modules: modulesOut,
      };
    });

    res.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Course import failed";
    res.status(500).json({ error: `Import failed (no changes were saved): ${message}` });
  }
});

export default router;
