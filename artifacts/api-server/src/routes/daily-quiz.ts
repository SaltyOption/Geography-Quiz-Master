import { Router, type IRouter } from "express";
import { db, quizzesTable } from "@workspace/db";

const router: IRouter = Router();

function todayKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

router.get("/daily-quiz", async (_req, res): Promise<void> => {
  const quizzes = await db
    .select({ id: quizzesTable.id })
    .from(quizzesTable)
    .orderBy(quizzesTable.id);

  if (quizzes.length === 0) {
    res.status(404).json({ error: "No quizzes available" });
    return;
  }

  const date = todayKey();
  const idx = hashString(date) % quizzes.length;
  res.json({ quizId: quizzes[idx].id, date });
});

export default router;
