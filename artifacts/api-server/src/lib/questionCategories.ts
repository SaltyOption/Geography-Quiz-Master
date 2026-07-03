import { eq, inArray } from "drizzle-orm";
import { db, categoriesTable, questionCategoriesTable } from "@workspace/db";

export type QuestionCategorySerialized = {
  id: number;
  name: string;
  slug: string;
};

/**
 * @param visibleCatIds when non-null (non-admin), only categories in this set
 *   are surfaced as question tags, so draft categories (and published children
 *   of draft ancestors) never leak to visitors. Pass `null` for admins.
 */
export async function getCategoriesByQuestionIds(
  questionIds: number[],
  visibleCatIds: Set<number> | null = null
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
    if (visibleCatIds !== null && !visibleCatIds.has(row.category.id)) continue;
    const arr = map.get(row.questionId) ?? [];
    arr.push({ id: row.category.id, name: row.category.name, slug: row.category.slug });
    map.set(row.questionId, arr);
  }
  return map;
}

export async function getCategoriesForQuestion(
  questionId: number,
  visibleCatIds: Set<number> | null = null
): Promise<QuestionCategorySerialized[]> {
  const map = await getCategoriesByQuestionIds([questionId], visibleCatIds);
  return map.get(questionId) ?? [];
}

type DbExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete">;

// Delete-then-insert, so it must run inside the caller's transaction (`dbc`):
// a failure after the delete would otherwise leave the question with no
// categories at all.
export async function setQuestionCategories(
  questionId: number,
  categoryIds: number[],
  dbc: DbExecutor = db
): Promise<void> {
  await dbc
    .delete(questionCategoriesTable)
    .where(eq(questionCategoriesTable.questionId, questionId));
  if (categoryIds.length === 0) return;

  const existing = await dbc
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(inArray(categoriesTable.id, categoryIds));
  const validIds = new Set(existing.map((c) => c.id));
  const toInsert = Array.from(new Set(categoryIds.filter((id) => validIds.has(id))));
  if (toInsert.length === 0) return;

  await dbc
    .insert(questionCategoriesTable)
    .values(toInsert.map((categoryId) => ({ questionId, categoryId })));
}
