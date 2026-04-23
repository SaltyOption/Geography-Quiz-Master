import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, questionsTable, quizzesTable } from "@workspace/db";
import {
  CreateQuestionBody,
  CreateQuestionParams,
  UpdateQuestionBody,
  UpdateQuestionParams,
  GetQuestionParams,
  DeleteQuestionParams,
  ListQuestionsParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.get("/quizzes/:id/questions", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListQuestionsParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, params.data.id))
    .orderBy(questionsTable.orderIndex);

  res.json(
    questions.map((q) => ({
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
    }))
  );
});

router.post("/quizzes/:id/questions", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateQuestionParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, params.data.id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  const parsed = CreateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [question] = await db
    .insert(questionsTable)
    .values({ ...parsed.data, quizId: params.data.id })
    .returning();

  res.status(201).json({
    id: question.id,
    quizId: question.quizId,
    text: question.text,
    options: question.options,
    correctOption: question.correctOption,
    explanation: question.explanation,
    funFact: question.funFact ?? null,
    imageUrl: question.imageUrl ?? null,
    orderIndex: question.orderIndex,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  });
});

router.get("/questions/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetQuestionParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.id, params.data.id));

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.json({
    id: question.id,
    quizId: question.quizId,
    text: question.text,
    options: question.options,
    correctOption: question.correctOption,
    explanation: question.explanation,
    funFact: question.funFact ?? null,
    imageUrl: question.imageUrl ?? null,
    orderIndex: question.orderIndex,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  });
});

router.patch("/questions/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateQuestionParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [question] = await db
    .update(questionsTable)
    .set(parsed.data)
    .where(eq(questionsTable.id, params.data.id))
    .returning();

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.json({
    id: question.id,
    quizId: question.quizId,
    text: question.text,
    options: question.options,
    correctOption: question.correctOption,
    explanation: question.explanation,
    funFact: question.funFact ?? null,
    imageUrl: question.imageUrl ?? null,
    orderIndex: question.orderIndex,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  });
});

router.delete("/questions/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteQuestionParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [question] = await db
    .delete(questionsTable)
    .where(eq(questionsTable.id, params.data.id))
    .returning();

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
