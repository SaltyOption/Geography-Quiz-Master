import { Router, type IRouter } from "express";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  questionsTable,
  quizzesTable,
  categoriesTable,
  questionCategoriesTable,
} from "@workspace/db";
import {
  CreateQuestionBody,
  CreateQuestionParams,
  UpdateQuestionBody,
  UpdateQuestionParams,
  GetQuestionParams,
  DeleteQuestionParams,
  ListQuestionsParams,
  ImportQuestionsByCategoryBody,
  ImportQuestionsByCategoryParams,
} from "@workspace/api-zod";
import { requireAdmin, isRequestAdmin } from "../middlewares/requireAdmin";
import {
  getCategoriesByQuestionIds,
  getCategoriesForQuestion,
  setQuestionCategories,
} from "../lib/questionCategories";
import { getVisibleCategoryIds } from "../lib/categoryVisibility";
import {
  validateImageUrlReachable,
  imageValidationMessage,
} from "../lib/imageValidation";
import { collectDescendantIds } from "../lib/categoryTree";

const router: IRouter = Router();

router.get("/quizzes/:id/questions", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListQuestionsParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Non-admins must not enumerate questions of a draft quiz (direct-link leak).
  const admin = isRequestAdmin(req);
  const [quiz] = await db
    .select({ published: quizzesTable.published })
    .from(quizzesTable)
    .where(eq(quizzesTable.id, params.data.id));
  if (!quiz || (!quiz.published && !admin)) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, params.data.id))
    .orderBy(questionsTable.orderIndex);

  const visibleCatIds = await getVisibleCategoryIds(admin);
  const catMap = await getCategoriesByQuestionIds(questions.map((q) => q.id), visibleCatIds);

  res.json(
    questions.map((q) => ({
      id: q.id,
      quizId: q.quizId,
      text: q.text,
      options: q.options,
      ...(admin ? {
        correctOption: q.correctOption,
        explanation: q.explanation,
        funFact: q.funFact ?? null,
      } : {}),
      imageUrl: q.imageUrl ?? null,
      orderIndex: q.orderIndex,
      categories: catMap.get(q.id) ?? [],
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

  const { categoryIds, ...questionData } = parsed.data;

  const imageError = await validateImageUrlReachable(questionData.imageUrl);
  if (imageError) {
    res.status(400).json({ error: imageValidationMessage(imageError) });
    return;
  }

  const question = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(questionsTable)
      .values({ ...questionData, quizId: params.data.id })
      .returning();
    if (categoryIds && categoryIds.length > 0) {
      await setQuestionCategories(created.id, categoryIds, tx);
    }
    return created;
  });

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
    categories: await getCategoriesForQuestion(question.id),
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  });
});

router.post(
  "/quizzes/:id/questions/import-by-category",
  requireAdmin,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const params = ImportQuestionsByCategoryParams.safeParse({ id: rawId });
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = ImportQuestionsByCategoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const quizId = params.data.id;
    const { categoryId } = parsed.data;

    const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId));
    if (!quiz) {
      res.status(404).json({ error: "Quiz not found" });
      return;
    }

    const [category] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId));
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    // Resolve the category and all its descendants.
    const allCats = await db
      .select({ id: categoriesTable.id, parentId: categoriesTable.parentId })
      .from(categoriesTable);
    const includedCategoryIds = [category.id, ...collectDescendantIds(category.id, allCats)];

    // Distinct source questions tagged with the category or any descendant.
    const taggedRows = await db
      .selectDistinct({ question: questionsTable })
      .from(questionCategoriesTable)
      .innerJoin(questionsTable, eq(questionCategoriesTable.questionId, questionsTable.id))
      .where(inArray(questionCategoriesTable.categoryId, includedCategoryIds));
    const sourceQuestions = taggedRows.map((r) => r.question);

    if (sourceQuestions.length === 0) {
      res.json({ imported: 0, skipped: 0, categoryName: category.name });
      return;
    }

    // Existing question texts in the target quiz, to skip duplicates and keep
    // re-runs idempotent.
    const existing = await db
      .select({ text: questionsTable.text })
      .from(questionsTable)
      .where(eq(questionsTable.quizId, quizId));
    const existingTexts = new Set(existing.map((q) => q.text));

    // Skip questions already living in this quiz, and any whose text is already present.
    const toCopy = sourceQuestions.filter(
      (q) => q.quizId !== quizId && !existingTexts.has(q.text)
    );
    const skipped = sourceQuestions.length - toCopy.length;

    if (toCopy.length === 0) {
      res.json({ imported: 0, skipped, categoryName: category.name });
      return;
    }

    // Tags of each source question, so copies retain them.
    const tagRows = await db
      .select({
        questionId: questionCategoriesTable.questionId,
        categoryId: questionCategoriesTable.categoryId,
      })
      .from(questionCategoriesTable)
      .where(inArray(questionCategoriesTable.questionId, toCopy.map((q) => q.id)));
    const tagsBySource = new Map<number, number[]>();
    for (const row of tagRows) {
      const arr = tagsBySource.get(row.questionId) ?? [];
      arr.push(row.categoryId);
      tagsBySource.set(row.questionId, arr);
    }

    const imported = await db.transaction(async (tx) => {
      const [maxRow] = await tx
        .select({ max: sql<number | null>`max(${questionsTable.orderIndex})` })
        .from(questionsTable)
        .where(eq(questionsTable.quizId, quizId));
      let nextOrder = (maxRow?.max ?? -1) + 1;

      const values = toCopy.map((q) => ({
        quizId,
        text: q.text,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
        funFact: q.funFact ?? null,
        imageUrl: q.imageUrl ?? null,
        orderIndex: nextOrder++,
      }));

      const inserted = await tx
        .insert(questionsTable)
        .values(values)
        .returning({ id: questionsTable.id });

      // Carry over each source question's tags to its new copy.
      const tagLinks: { questionId: number; categoryId: number }[] = [];
      for (let i = 0; i < toCopy.length; i++) {
        const newId = inserted[i].id;
        for (const catId of tagsBySource.get(toCopy[i].id) ?? []) {
          tagLinks.push({ questionId: newId, categoryId: catId });
        }
      }
      if (tagLinks.length > 0) {
        await tx.insert(questionCategoriesTable).values(tagLinks);
      }

      return inserted.length;
    });

    res.json({ imported, skipped, categoryName: category.name });
  }
);

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

  // A question of a draft quiz must not leak to non-admins via its direct link.
  const admin = isRequestAdmin(req);
  if (!admin) {
    const [quiz] = await db
      .select({ published: quizzesTable.published })
      .from(quizzesTable)
      .where(eq(quizzesTable.id, question.quizId));
    if (!quiz || !quiz.published) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
  }

  const visibleCatIds = await getVisibleCategoryIds(admin);

  res.json({
    id: question.id,
    quizId: question.quizId,
    text: question.text,
    options: question.options,
    ...(admin ? {
      correctOption: question.correctOption,
      explanation: question.explanation,
      funFact: question.funFact ?? null,
    } : {}),
    imageUrl: question.imageUrl ?? null,
    orderIndex: question.orderIndex,
    categories: await getCategoriesForQuestion(question.id, visibleCatIds),
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

  const { categoryIds, ...updateFields } = parsed.data;

  if (updateFields.imageUrl !== undefined) {
    const imageError = await validateImageUrlReachable(updateFields.imageUrl);
    if (imageError) {
      res.status(400).json({ error: imageValidationMessage(imageError) });
      return;
    }
  }

  // One transaction: a failure while replacing categories must roll back the
  // field update too, not leave the question updated with categories wiped.
  const question = await db.transaction(async (tx) => {
    let updated: typeof questionsTable.$inferSelect | undefined;
    if (Object.keys(updateFields).length > 0) {
      [updated] = await tx
        .update(questionsTable)
        .set(updateFields)
        .where(eq(questionsTable.id, params.data.id))
        .returning();
    } else {
      [updated] = await tx
        .select()
        .from(questionsTable)
        .where(eq(questionsTable.id, params.data.id));
    }

    if (updated && categoryIds !== undefined) {
      await setQuestionCategories(updated.id, categoryIds, tx);
    }
    return updated;
  });

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
    categories: await getCategoriesForQuestion(question.id),
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
