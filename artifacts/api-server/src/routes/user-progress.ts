import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, quizAttemptsTable, quizzesTable } from "@workspace/db";
import { GetUserQuizProgressParams } from "@workspace/api-zod";
import { isRequestAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
};

router.get("/user/progress", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const admin = isRequestAdmin(req);

  const allAttempts = await db
    .select({
      id: quizAttemptsTable.id,
      quizId: quizAttemptsTable.quizId,
      quizTitle: quizzesTable.title,
      published: quizzesTable.published,
      score: quizAttemptsTable.score,
      totalQuestions: quizAttemptsTable.totalQuestions,
      completedAt: quizAttemptsTable.createdAt,
    })
    .from(quizAttemptsTable)
    .innerJoin(quizzesTable, eq(quizAttemptsTable.quizId, quizzesTable.id))
    .where(eq(quizAttemptsTable.userId, userId))
    .orderBy(desc(quizAttemptsTable.createdAt))
    .limit(50);

  // Non-admins never see attempts whose quiz has since been moved to draft.
  const attempts = admin ? allAttempts : allAttempts.filter((a) => a.published);

  const totalAttempts = attempts.length;
  const uniqueQuizIds = new Set(attempts.map((a) => a.quizId));
  const totalQuizzesTaken = uniqueQuizIds.size;

  const percentages = attempts.map((a) =>
    a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0
  );
  const averagePercentage =
    percentages.length > 0
      ? Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 10) / 10
      : 0;
  const bestPercentage =
    percentages.length > 0 ? Math.round(Math.max(...percentages) * 10) / 10 : 0;

  res.json({
    totalAttempts,
    totalQuizzesTaken,
    averagePercentage,
    bestPercentage,
    recentAttempts: attempts.map((a) => ({
      id: a.id,
      quizId: a.quizId,
      quizTitle: a.quizTitle,
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage:
        a.totalQuestions > 0
          ? Math.round((a.score / a.totalQuestions) * 1000) / 10
          : 0,
      completedAt: a.completedAt.toISOString(),
    })),
  });
});

router.get("/user/progress/:quizId", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const admin = isRequestAdmin(req);
  const rawId = Array.isArray(req.params.quizId) ? req.params.quizId[0] : req.params.quizId;
  const params = GetUserQuizProgressParams.safeParse({ quizId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const attempts = await db
    .select({
      id: quizAttemptsTable.id,
      quizId: quizAttemptsTable.quizId,
      quizTitle: quizzesTable.title,
      published: quizzesTable.published,
      score: quizAttemptsTable.score,
      totalQuestions: quizAttemptsTable.totalQuestions,
      completedAt: quizAttemptsTable.createdAt,
    })
    .from(quizAttemptsTable)
    .innerJoin(quizzesTable, eq(quizAttemptsTable.quizId, quizzesTable.id))
    .where(eq(quizAttemptsTable.userId, userId))
    .orderBy(desc(quizAttemptsTable.createdAt));

  // Non-admins never see history for a quiz that has since been moved to draft.
  const quizAttempts = attempts.filter(
    (a) => a.quizId === params.data.quizId && (admin || a.published),
  );

  const bestScore = quizAttempts.length > 0 ? Math.max(...quizAttempts.map((a) => a.score)) : 0;
  const bestPercentage =
    quizAttempts.length > 0
      ? Math.round(
          Math.max(
            ...quizAttempts.map((a) =>
              a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0
            )
          ) * 10
        ) / 10
      : 0;

  res.json({
    quizId: params.data.quizId,
    attempts: quizAttempts.length,
    bestScore,
    bestPercentage,
    lastAttemptAt: quizAttempts.length > 0 ? quizAttempts[0].completedAt.toISOString() : null,
    history: quizAttempts.map((a) => ({
      id: a.id,
      quizId: a.quizId,
      quizTitle: a.quizTitle,
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage:
        a.totalQuestions > 0
          ? Math.round((a.score / a.totalQuestions) * 1000) / 10
          : 0,
      completedAt: a.completedAt.toISOString(),
    })),
  });
});

export default router;
