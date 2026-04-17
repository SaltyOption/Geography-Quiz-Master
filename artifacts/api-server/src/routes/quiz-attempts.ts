import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, questionsTable, quizAttemptsTable } from "@workspace/db";
import { SubmitQuizAttemptBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/quiz-attempts", async (req, res): Promise<void> => {
  const parsed = SubmitQuizAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { quizId, answers } = parsed.data;

  const questionIds = answers.map((a) => a.questionId);
  const questions = await db
    .select()
    .from(questionsTable)
    .where(inArray(questionsTable.id, questionIds));

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  let score = 0;
  const questionResults = answers.map((answer) => {
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
  }).filter(Boolean);

  const totalQuestions = questionResults.length;

  await db.insert(quizAttemptsTable).values({
    quizId,
    score,
    totalQuestions,
    answers: answers,
  });

  res.json({
    quizId,
    score,
    totalQuestions,
    percentage: totalQuestions > 0 ? Math.round((score / totalQuestions) * 100 * 10) / 10 : 0,
    questionResults,
  });
});

export default router;
