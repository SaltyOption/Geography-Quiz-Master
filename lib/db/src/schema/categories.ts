import { pgTable, text, serial, timestamp, integer, boolean, primaryKey, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { quizzesTable } from "./quizzes";
import { questionsTable } from "./questions";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id").references((): AnyPgColumn => categoriesTable.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const quizCategoriesTable = pgTable(
  "quiz_categories",
  {
    quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.quizId, t.categoryId] }),
    // The composite PK only serves quiz-first lookups; the category tree and
    // import-by-category filter by category.
    index("quiz_categories_category_id_idx").on(t.categoryId),
  ],
);

export const questionCategoriesTable = pgTable(
  "question_categories",
  {
    questionId: integer("question_id").notNull().references(() => questionsTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.questionId, t.categoryId] }),
    index("question_categories_category_id_idx").on(t.categoryId),
  ],
);

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
