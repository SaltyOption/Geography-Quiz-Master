import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import {
  db,
  quizzesTable,
  questionsTable,
  quizAttemptsTable,
  categoriesTable,
  quizCategoriesTable,
} from "@workspace/db";
import {
  CreateQuizBody,
  UpdateQuizBody,
  GetQuizParams,
  UpdateQuizParams,
  DeleteQuizParams,
  GetQuizStatsParams,
  BulkImportQuizzesBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

type CategorySerialized = {
  id: number;
  name: string;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
};

const serializeCategory = (c: typeof categoriesTable.$inferSelect): CategorySerialized => ({
  id: c.id,
  name: c.name,
  parentId: c.parentId,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

async function getCategoriesByQuizIds(quizIds: number[]): Promise<Map<number, CategorySerialized[]>> {
  const map = new Map<number, CategorySerialized[]>();
  if (quizIds.length === 0) return map;

  const rows = await db
    .select({
      quizId: quizCategoriesTable.quizId,
      category: categoriesTable,
    })
    .from(quizCategoriesTable)
    .innerJoin(categoriesTable, eq(quizCategoriesTable.categoryId, categoriesTable.id))
    .where(inArray(quizCategoriesTable.quizId, quizIds));

  for (const row of rows) {
    const arr = map.get(row.quizId) ?? [];
    arr.push(serializeCategory(row.category));
    map.set(row.quizId, arr);
  }
  return map;
}

async function setQuizCategories(quizId: number, categoryIds: number[]): Promise<void> {
  await db.delete(quizCategoriesTable).where(eq(quizCategoriesTable.quizId, quizId));
  if (categoryIds.length === 0) return;

  const existing = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(inArray(categoriesTable.id, categoryIds));
  const validIds = new Set(existing.map((c) => c.id));
  const toInsert = categoryIds.filter((id) => validIds.has(id));
  if (toInsert.length === 0) return;

  await db
    .insert(quizCategoriesTable)
    .values(toInsert.map((categoryId) => ({ quizId, categoryId })));
}

router.get("/quizzes", async (_req, res): Promise<void> => {
  const quizzes = await db.select().from(quizzesTable).orderBy(quizzesTable.createdAt);

  const counts = await db
    .select({ quizId: questionsTable.quizId, count: sql<number>`count(*)::int` })
    .from(questionsTable)
    .groupBy(questionsTable.quizId);
  const countMap = new Map(counts.map((c) => [c.quizId, c.count]));

  const catMap = await getCategoriesByQuizIds(quizzes.map((q) => q.id));

  const result = quizzes.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    category: q.category,
    difficulty: q.difficulty,
    questionCount: countMap.get(q.id) ?? 0,
    categories: catMap.get(q.id) ?? [],
    createdAt: q.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/quizzes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { categoryIds, ...quizData } = parsed.data;

  const [quiz] = await db.insert(quizzesTable).values(quizData).returning();

  if (categoryIds && categoryIds.length > 0) {
    await setQuizCategories(quiz.id, categoryIds);
  }

  res.status(201).json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    category: quiz.category,
    difficulty: quiz.difficulty,
    createdAt: quiz.createdAt.toISOString(),
    updatedAt: quiz.updatedAt.toISOString(),
  });
});

router.get("/quizzes/export", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      quizId: quizzesTable.id,
      quizTitle: quizzesTable.title,
      quizDifficulty: quizzesTable.difficulty,
      questionId: questionsTable.id,
      questionText: questionsTable.text,
      options: questionsTable.options,
      correctOption: questionsTable.correctOption,
      explanation: questionsTable.explanation,
      funFact: questionsTable.funFact,
      imageUrl: questionsTable.imageUrl,
      orderIndex: questionsTable.orderIndex,
    })
    .from(quizzesTable)
    .innerJoin(questionsTable, eq(questionsTable.quizId, quizzesTable.id))
    .orderBy(quizzesTable.title, questionsTable.orderIndex, questionsTable.id);

  // Fail-fast on malformed data so the round-trip is never silently lossy.
  const invalid: Array<{ questionId: number; quizTitle: string; reason: string }> = [];
  for (const r of rows) {
    if (!Array.isArray(r.options) || r.options.length !== 4) {
      invalid.push({
        questionId: r.questionId,
        quizTitle: r.quizTitle,
        reason: `expected 4 options, got ${Array.isArray(r.options) ? r.options.length : "non-array"}`,
      });
    } else if (r.correctOption < 0 || r.correctOption > 3) {
      invalid.push({
        questionId: r.questionId,
        quizTitle: r.quizTitle,
        reason: `correctOption ${r.correctOption} is out of range [0,3]`,
      });
    }
  }
  if (invalid.length > 0) {
    res.status(422).json({
      error:
        "Cannot export: some questions are malformed and would not round-trip cleanly. Fix or delete them, then try again.",
      invalid,
    });
    return;
  }

  // Surface quizzes that have no questions so admins know they aren't included
  // (the bulk-import format is question-driven and can't represent empty quizzes).
  const exportedQuizIds = new Set(rows.map((r) => r.quizId));
  const allQuizzes = await db
    .select({ id: quizzesTable.id, title: quizzesTable.title })
    .from(quizzesTable)
    .orderBy(quizzesTable.title);
  const skippedEmptyQuizzes = allQuizzes
    .filter((q) => !exportedQuizIds.has(q.id))
    .map((q) => q.title);

  const letters = ["A", "B", "C", "D"] as const;
  const items = rows.map((r) => ({
    topic: r.quizTitle,
    question: r.questionText,
    options: {
      A: r.options[0],
      B: r.options[1],
      C: r.options[2],
      D: r.options[3],
    },
    correct_answer: letters[r.correctOption],
    explanation: r.explanation,
    fun_fact: r.funFact ?? null,
    difficulty: r.quizDifficulty,
    image_url: r.imageUrl ?? null,
  }));

  res.json({ items, skippedEmptyQuizzes });
});

router.post("/quizzes/bulk-import", requireAdmin, async (req, res): Promise<void> => {
  // Accept either an envelope { items, categoryIds } or a bare array of items.
  const body = Array.isArray(req.body) ? { items: req.body } : req.body;
  const parsed = BulkImportQuizzesBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, categoryIds } = parsed.data;
  if (items.length === 0) {
    res.json({ quizzesCreated: 0, quizzesUpdated: 0, questionsAdded: 0, topics: [] });
    return;
  }

  // Normalize topic whitespace and group items by normalized topic, preserving first-seen order.
  const byTopic = new Map<string, typeof items>();
  for (const item of items) {
    const topic = item.topic.trim();
    const arr = byTopic.get(topic) ?? [];
    arr.push({ ...item, topic });
    byTopic.set(topic, arr);
  }

  try {
    const summary = await db.transaction(async (tx) => {
      const topicResults: Array<{
        topic: string;
        quizId: number;
        created: boolean;
        questionsAdded: number;
      }> = [];
      let quizzesCreated = 0;
      let quizzesUpdated = 0;
      let questionsAdded = 0;

      for (const [topic, topicItems] of byTopic) {
        // Most common difficulty among the topic's questions, defaulting to "Medium".
        const diffCounts = new Map<string, number>();
        for (const i of topicItems) {
          const d = (i.difficulty ?? "Medium").trim() || "Medium";
          diffCounts.set(d, (diffCounts.get(d) ?? 0) + 1);
        }
        const difficulty =
          [...diffCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Medium";

        // Find existing quiz by exact title; otherwise create one.
        const [existing] = await tx
          .select()
          .from(quizzesTable)
          .where(eq(quizzesTable.title, topic))
          .limit(1);

        let quizId: number;
        let created = false;
        if (existing) {
          quizId = existing.id;
          quizzesUpdated += 1;
        } else {
          const [inserted] = await tx
            .insert(quizzesTable)
            .values({
              title: topic,
              description: `A quiz on ${topic}`,
              category: topic,
              difficulty,
            })
            .returning();
          quizId = inserted.id;
          created = true;
          quizzesCreated += 1;
          if (categoryIds && categoryIds.length > 0) {
            // Inline category attach inside the transaction.
            const validCats = await tx
              .select({ id: categoriesTable.id })
              .from(categoriesTable)
              .where(inArray(categoriesTable.id, categoryIds));
            const validIds = new Set(validCats.map((c) => c.id));
            const toInsert = categoryIds.filter((id) => validIds.has(id));
            if (toInsert.length > 0) {
              await tx
                .insert(quizCategoriesTable)
                .values(toInsert.map((categoryId) => ({ quizId, categoryId })));
            }
          }
        }

        // Determine starting orderIndex for new questions (append after existing).
        const [maxRow] = await tx
          .select({ max: sql<number | null>`max(${questionsTable.orderIndex})` })
          .from(questionsTable)
          .where(eq(questionsTable.quizId, quizId));
        let nextOrder = (maxRow?.max ?? -1) + 1;

        const rows = topicItems.map((item) => {
          const opts = [item.options.A, item.options.B, item.options.C, item.options.D];
          const correctIndex = ["A", "B", "C", "D"].indexOf(item.correct_answer);
          return {
            quizId,
            text: item.question,
            options: opts,
            correctOption: correctIndex,
            explanation: item.explanation,
            funFact: item.fun_fact ?? null,
            imageUrl: item.image_url ?? null,
            orderIndex: nextOrder++,
          };
        });

        if (rows.length > 0) {
          await tx.insert(questionsTable).values(rows);
          questionsAdded += rows.length;
        }

        topicResults.push({ topic, quizId, created, questionsAdded: rows.length });
      }

      return { quizzesCreated, quizzesUpdated, questionsAdded, topics: topicResults };
    });

    res.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bulk import failed";
    res.status(500).json({ error: `Import failed (no changes were saved): ${message}` });
  }
});

router.get("/quizzes/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetQuizParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, params.data.id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, quiz.id))
    .orderBy(questionsTable.orderIndex);

  const catMap = await getCategoriesByQuizIds([quiz.id]);

  res.json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    category: quiz.category,
    difficulty: quiz.difficulty,
    categories: catMap.get(quiz.id) ?? [],
    createdAt: quiz.createdAt.toISOString(),
    updatedAt: quiz.updatedAt.toISOString(),
    questions: questions.map((q) => ({
      id: q.id,
      quizId: q.quizId,
      text: q.text,
      options: q.options,
      correctOption: q.correctOption,
      explanation: q.explanation,
      funFact: q.funFact ?? null,
      imageUrl: q.imageUrl ?? null,
      orderIndex: q.orderIndex,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    })),
  });
});

router.patch("/quizzes/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateQuizParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { categoryIds, ...updateFields } = parsed.data;

  let quiz: typeof quizzesTable.$inferSelect | undefined;
  if (Object.keys(updateFields).length > 0) {
    [quiz] = await db
      .update(quizzesTable)
      .set(updateFields)
      .where(eq(quizzesTable.id, params.data.id))
      .returning();
  } else {
    [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, params.data.id));
  }

  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  if (categoryIds !== undefined) {
    await setQuizCategories(quiz.id, categoryIds);
  }

  res.json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    category: quiz.category,
    difficulty: quiz.difficulty,
    createdAt: quiz.createdAt.toISOString(),
    updatedAt: quiz.updatedAt.toISOString(),
  });
});

router.delete("/quizzes/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteQuizParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [quiz] = await db
    .delete(quizzesTable)
    .where(eq(quizzesTable.id, params.data.id))
    .returning();

  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/quizzes/:id/stats", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetQuizStatsParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, params.data.id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  const attempts = await db
    .select({ score: quizAttemptsTable.score, totalQuestions: quizAttemptsTable.totalQuestions })
    .from(quizAttemptsTable)
    .where(eq(quizAttemptsTable.quizId, params.data.id));

  const totalAttempts = attempts.length;
  const averageScore = totalAttempts > 0
    ? attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts
    : 0;
  const averagePercentage = totalAttempts > 0
    ? attempts.reduce((sum, a) => sum + (a.score / a.totalQuestions) * 100, 0) / totalAttempts
    : 0;

  res.json({
    quizId: params.data.id,
    totalAttempts,
    averageScore: Math.round(averageScore * 10) / 10,
    averagePercentage: Math.round(averagePercentage * 10) / 10,
  });
});

export default router;
