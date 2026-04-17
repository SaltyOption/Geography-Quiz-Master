import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, quizzesTable, questionsTable, quizAttemptsTable } from "@workspace/db";
import {
  CreateQuizBody,
  UpdateQuizBody,
  GetQuizParams,
  UpdateQuizParams,
  DeleteQuizParams,
  GetQuizStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/quizzes", async (req, res): Promise<void> => {
  const quizzes = await db.select().from(quizzesTable).orderBy(quizzesTable.createdAt);

  const counts = await db
    .select({ quizId: questionsTable.quizId, count: sql<number>`count(*)::int` })
    .from(questionsTable)
    .groupBy(questionsTable.quizId);

  const countMap = new Map(counts.map((c) => [c.quizId, c.count]));

  const result = quizzes.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    category: q.category,
    difficulty: q.difficulty,
    questionCount: countMap.get(q.id) ?? 0,
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

  const [quiz] = await db.insert(quizzesTable).values(parsed.data).returning();
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

  res.json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    category: quiz.category,
    difficulty: quiz.difficulty,
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

  const [quiz] = await db
    .update(quizzesTable)
    .set(parsed.data)
    .where(eq(quizzesTable.id, params.data.id))
    .returning();

  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
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
