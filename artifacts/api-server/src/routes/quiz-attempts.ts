import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, questionsTable, quizAttemptsTable, quizzesTable } from "@workspace/db";
import { SubmitQuizAttemptBody } from "@workspace/api-zod";
import { isRequestAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.post("/quiz-attempts", async (req, res): Promise<void> => {
  const parsed = SubmitQuizAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { quizId, answers } = parsed.data;
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

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

  const questionIds = answers.map((a) => a.questionId);
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
  const questionResults = answers
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

  await db.insert(quizAttemptsTable).values({
    quizId,
    userId,
    score,
    totalQuestions,
    answers: answers,
  });

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
