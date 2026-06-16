import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, questionsTable, quizAttemptsTable, quizzesTable } from "@workspace/db";
import { SubmitQuizAttemptBody } from "@workspace/api-zod";
import { isRequestAdmin } from "../middlewares/requireAdmin";
import { createRateLimiter, getRateLimitKey } from "../lib/rateLimit";

const router: IRouter = Router();

// Simple in-memory sliding-window rate limiter for attempt submissions, keyed
// by authenticated userId (or remote IP for anonymous callers): 30 attempts
// per 10-minute window per key.
const checkRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
});

router.post("/quiz-attempts", async (req, res): Promise<void> => {
  const parsed = SubmitQuizAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { quizId, answers } = parsed.data;
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  const rateLimitKey = getRateLimitKey(req, userId);
  if (!checkRateLimit(rateLimitKey)) {
    res.status(429).json({ error: "Too many attempts. Please try again later." });
    return;
  }

  // Visibility gate: non-admins may only submit against a published quiz, so
  // draft question content (correctOption/explanation/funFact) can't be probed.
  const admin = isRequestAdmin(req);
  const [quiz] = await db
    .select({ published: quizzesTable.published })
    .from(quizzesTable)
    .where(eq(quizzesTable.id, quizId));
  if (!quiz || (!quiz.published && !admin)) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  // Deduplicate answers by questionId — take the first occurrence only.
  // Duplicate entries would let a caller artificially inflate their score by
  // submitting the same correct question multiple times in one request.
  const seenQuestionIds = new Set<number>();
  const deduplicatedAnswers = answers.filter((a) => {
    if (seenQuestionIds.has(a.questionId)) return false;
    seenQuestionIds.add(a.questionId);
    return true;
  });

  const questionIds = deduplicatedAnswers.map((a) => a.questionId);
  const questions = await db
    .select()
    .from(questionsTable)
    .where(inArray(questionsTable.id, questionIds));

  // Only questions that actually belong to this quiz are scorable; this blocks
  // cross-quiz question-id injection from exfiltrating other quizzes' answers.
  const questionMap = new Map(
    questions.filter((q) => q.quizId === quizId).map((q) => [q.id, q]),
  );

  let score = 0;
  const questionResults = deduplicatedAnswers
    .map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) return null;
      const isCorrect = answer.selectedOption === question.correctOption;
      if (isCorrect) score++;
      return {
        questionId: answer.questionId,
        isCorrect,
        selectedOption: answer.selectedOption,
        correctOption: question.correctOption,
        explanation: question.explanation,
        funFact: question.funFact ?? null,
      };
    })
    .filter(Boolean);

  const totalQuestions = questionResults.length;

  // Reject submissions that contain no scorable in-quiz answers. Persisting
  // a row with totalQuestions = 0 would cause a zero-division NaN in the
  // stats aggregation route and contributes nothing meaningful.
  if (totalQuestions === 0) {
    res.status(400).json({ error: "No valid answers for this quiz" });
    return;
  }

  // Only persist attempts for authenticated users. Anonymous users still receive
  // their scored results for the current session, but we do not write to the
  // database — preventing unauthenticated write amplification and stats poisoning.
  if (userId !== null) {
    await db.insert(quizAttemptsTable).values({
      quizId,
      userId,
      score,
      totalQuestions,
      answers: deduplicatedAnswers,
    });
  }

  res.json({
    quizId,
    score,
    totalQuestions,
    percentage:
      totalQuestions > 0 ? Math.round((score / totalQuestions) * 100 * 10) / 10 : 0,
    questionResults,
  });
});

export default router;
