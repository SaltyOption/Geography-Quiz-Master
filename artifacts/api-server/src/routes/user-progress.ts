import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, desc, sql, type SQL } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, quizAttemptsTable, quizzesTable } from "@workspace/db";
import { GetUserQuizProgressParams } from "@workspace/api-zod";
import { isRequestAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

function getUserId(req: Request, res: Response): string | null {
  const userId = getAuth(req)?.userId ?? null;
  if (!userId) res.status(401).json({ error: "Unauthorized" });
  return userId;
}

/**
 * Attempts joined to their quiz, visible to this caller: non-admins never see
 * attempts whose quiz has since been moved to draft. Applied in SQL so limits
 * and aggregates operate on the visible set, not on rows discarded afterwards.
 */
function visibleAttemptsFilter(userId: string, admin: boolean, extra?: SQL): SQL | undefined {
  return and(
    eq(quizAttemptsTable.userId, userId),
    ...(admin ? [] : [eq(quizzesTable.published, true)]),
    ...(extra ? [extra] : []),
  );
}

const percentageExpr = sql<number>`
  case when ${quizAttemptsTable.totalQuestions} > 0
    then ${quizAttemptsTable.score}::numeric * 100 / ${quizAttemptsTable.totalQuestions}
    else 0
  end`;

router.get("/user/progress", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const admin = isRequestAdmin(req);
  const where = visibleAttemptsFilter(userId, admin);

  // Aggregates cover the user's full visible history; the 50-row limit below
  // only bounds the recent-attempts list.
  const [stats] = await db
    .select({
      totalAttempts: sql<number>`count(*)::int`,
      totalQuizzesTaken: sql<number>`count(distinct ${quizAttemptsTable.quizId})::int`,
      averagePercentage: sql<number>`coalesce(round(avg(${percentageExpr}), 1), 0)::float`,
      bestPercentage: sql<number>`coalesce(round(max(${percentageExpr}), 1), 0)::float`,
    })
    .from(quizAttemptsTable)
    .innerJoin(quizzesTable, eq(quizAttemptsTable.quizId, quizzesTable.id))
    .where(where);

  const attempts = await db
    .select({
      id: quizAttemptsTable.id,
      quizId: quizAttemptsTable.quizId,
      quizTitle: quizzesTable.title,
      score: quizAttemptsTable.score,
      totalQuestions: quizAttemptsTable.totalQuestions,
      completedAt: quizAttemptsTable.createdAt,
    })
    .from(quizAttemptsTable)
    .innerJoin(quizzesTable, eq(quizAttemptsTable.quizId, quizzesTable.id))
    .where(where)
    .orderBy(desc(quizAttemptsTable.createdAt))
    .limit(50);

  res.json({
    totalAttempts: stats?.totalAttempts ?? 0,
    totalQuizzesTaken: stats?.totalQuizzesTaken ?? 0,
    averagePercentage: stats?.averagePercentage ?? 0,
    bestPercentage: stats?.bestPercentage ?? 0,
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

router.get("/user/progress/:quizId", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const admin = isRequestAdmin(req);
  const rawId = Array.isArray(req.params.quizId) ? req.params.quizId[0] : req.params.quizId;
  const params = GetUserQuizProgressParams.safeParse({ quizId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const quizAttempts = await db
    .select({
      id: quizAttemptsTable.id,
      quizId: quizAttemptsTable.quizId,
      quizTitle: quizzesTable.title,
      score: quizAttemptsTable.score,
      totalQuestions: quizAttemptsTable.totalQuestions,
      completedAt: quizAttemptsTable.createdAt,
    })
    .from(quizAttemptsTable)
    .innerJoin(quizzesTable, eq(quizAttemptsTable.quizId, quizzesTable.id))
    .where(
      visibleAttemptsFilter(userId, admin, eq(quizAttemptsTable.quizId, params.data.quizId)),
    )
    .orderBy(desc(quizAttemptsTable.createdAt));

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
