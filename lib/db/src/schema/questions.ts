import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { quizzesTable } from "./quizzes";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  options: text("options").array().notNull(),
  correctOption: integer("correct_option").notNull(),
  explanation: text("explanation").notNull(),
  funFact: text("fun_fact"),
  imageUrl: text("image_url"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  // Every question read goes through "questions for this quiz".
  index("questions_quiz_id_idx").on(t.quizId),
]);

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
