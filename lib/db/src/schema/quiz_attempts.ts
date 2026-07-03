import { pgTable, serial, timestamp, integer, jsonb, text, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { quizzesTable } from "./quizzes";

export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  answers: jsonb("answers").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Profile/progress reads: a user's attempts, newest first.
  index("quiz_attempts_user_created_idx").on(t.userId, t.createdAt),
  // Per-quiz stats aggregation.
  index("quiz_attempts_quiz_id_idx").on(t.quizId),
]);

export const insertQuizAttemptSchema = createInsertSchema(quizAttemptsTable).omit({ id: true, createdAt: true });
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;
