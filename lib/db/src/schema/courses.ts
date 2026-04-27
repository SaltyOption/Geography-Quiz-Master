import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const courseModulesTable = pgTable(
  "course_modules",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => coursesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("course_modules_course_slug_idx").on(t.courseId, t.slug)],
);

export const courseLessonsTable = pgTable(
  "course_lessons",
  {
    id: serial("id").primaryKey(),
    moduleId: integer("module_id")
      .notNull()
      .references(() => courseModulesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("course_lessons_module_slug_idx").on(t.moduleId, t.slug)],
);

export const courseQuestionsTable = pgTable("course_questions", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => courseLessonsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  options: text("options").array().notNull(),
  correctOption: integer("correct_option").notNull(),
  explanation: text("explanation").notNull(),
  funFact: text("fun_fact"),
  learningObjective: text("learning_objective"),
  difficulty: text("difficulty"),
  questionType: text("question_type"),
  masteryWeight: integer("mastery_weight").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const courseModuleAttemptsTable = pgTable("course_module_attempts", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id")
    .notNull()
    .references(() => courseModulesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  percentage: integer("percentage").notNull(),
  mastered: boolean("mastered").notNull().default(false),
  answers: jsonb("answers").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Saved progress for a logged-in user mid-module. One row per (user, module).
// Cleared automatically when the user submits a final attempt.
export const courseModuleProgressTable = pgTable(
  "course_module_progress",
  {
    id: serial("id").primaryKey(),
    moduleId: integer("module_id")
      .notNull()
      .references(() => courseModulesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    answers: jsonb("answers").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("course_module_progress_user_module_idx").on(t.userId, t.moduleId)],
);

export type CourseModuleProgress = typeof courseModuleProgressTable.$inferSelect;

export const insertCourseSchema = createInsertSchema(coursesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof coursesTable.$inferSelect;

export type CourseModule = typeof courseModulesTable.$inferSelect;
export type CourseLesson = typeof courseLessonsTable.$inferSelect;
export type CourseQuestion = typeof courseQuestionsTable.$inferSelect;
export type CourseModuleAttempt = typeof courseModuleAttemptsTable.$inferSelect;
