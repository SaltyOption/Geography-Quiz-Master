import { eq, inArray } from "drizzle-orm";
import { db, categoriesTable, questionCategoriesTable } from "@workspace/db";

export type QuestionCategorySerialized = {
  id: number;
  name: string;
  slug: string;
};

export async function getCategoriesByQuestionIds(
  questionIds: number[]
): Promise<Map<number, QuestionCategorySerialized[]>> {
  const map = new Map<number, QuestionCategorySerialized[]>();
  if (questionIds.length === 0) return map;

  const rows = await db
    .select({
      questionId: questionCategoriesTable.questionId,
      category: categoriesTable,
    })
    .from(questionCategoriesTable)
    .innerJoin(categoriesTable, eq(questionCategoriesTable.categoryId, categoriesTable.id))
    .where(inArray(questionCategoriesTable.questionId, questionIds));

  for (const row of rows) {
    const arr = map.get(row.questionId) ?? [];
    arr.push({ id: row.category.id, name: row.category.name, slug: row.category.slug });
    map.set(row.questionId, arr);
  }
  return map;
}

export async function getCategoriesForQuestion(
  questionId: number
): Promise<QuestionCategorySerialized[]> {
  const map = await getCategoriesByQuestionIds([questionId]);
  return map.get(questionId) ?? [];
}

export async function setQuestionCategories(
  questionId: number,
  categoryIds: number[]
): Promise<void> {
  await db
    .delete(questionCategoriesTable)
    .where(eq(questionCategoriesTable.questionId, questionId));
  if (categoryIds.length === 0) return;

  const existing = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(inArray(categoriesTable.id, categoryIds));
  const validIds = new Set(existing.map((c) => c.id));
  const toInsert = Array.from(new Set(categoryIds.filter((id) => validIds.has(id))));
  if (toInsert.length === 0) return;

  await db
    .insert(questionCategoriesTable)
    .values(toInsert.map((categoryId) => ({ questionId, categoryId })));
}
