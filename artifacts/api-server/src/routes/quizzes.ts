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
} from "@workspace/api-zod";

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

router.post("/quizzes", async (req, res): Promise<void> => {
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

router.patch("/quizzes/:id", async (req, res): Promise<void> => {
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

router.delete("/quizzes/:id", async (req, res): Promise<void> => {
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
