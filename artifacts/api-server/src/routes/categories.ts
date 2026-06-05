import { Router, type IRouter } from "express";
import { eq, sql, asc, inArray } from "drizzle-orm";
import {
  db,
  categoriesTable,
  quizCategoriesTable,
  quizzesTable,
  questionsTable,
  questionCategoriesTable,
} from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  DeleteCategoryParams,
} from "@workspace/api-zod";
import { requireAdmin, isRequestAdmin } from "../middlewares/requireAdmin";
import { slugify, uniqueSlug } from "../lib/categorySlug";
import { isCategoryVisible } from "../lib/categoryVisibility";

const router: IRouter = Router();

const serializeCategory = (c: typeof categoriesTable.$inferSelect) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  parentId: c.parentId,
  imageUrl: c.imageUrl,
  published: c.published,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

function collectDescendantIds(
  rootId: number,
  all: { id: number; parentId: number | null }[]
): number[] {
  const descendantIds: number[] = [];
  const queue: number[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const c of all) {
      if (c.parentId === id) {
        descendantIds.push(c.id);
        queue.push(c.id);
      }
    }
  }
  return descendantIds;
}

router.get("/categories", async (req, res): Promise<void> => {
  const admin = isRequestAdmin(req);
  const all = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  const byId = new Map(all.map((c) => [c.id, c]));
  const categories = admin ? all : all.filter((c) => isCategoryVisible(c, byId));
  res.json(categories.map(serializeCategory));
});

router.get("/categories/tree", async (req, res): Promise<void> => {
  const admin = isRequestAdmin(req);
  const allCategories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  const byId = new Map(allCategories.map((c) => [c.id, c]));
  const categories = admin
    ? allCategories
    : allCategories.filter((c) => isCategoryVisible(c, byId));

  // Quiz counts per category. For non-admins, only published quizzes are counted
  // so visitors never see inflated counts driven by hidden drafts.
  const quizLinks = await db
    .select({ categoryId: quizCategoriesTable.categoryId, published: quizzesTable.published })
    .from(quizCategoriesTable)
    .innerJoin(quizzesTable, eq(quizCategoriesTable.quizId, quizzesTable.id));
  const countMap = new Map<number, number>();
  for (const link of quizLinks) {
    if (!admin && !link.published) continue;
    countMap.set(link.categoryId, (countMap.get(link.categoryId) ?? 0) + 1);
  }

  // Direct question tags per category: categoryId -> set of question ids. Each
  // question belongs to a quiz, so for non-admins we count only questions whose
  // parent quiz is published — otherwise draft-quiz question volume would leak
  // through taggedQuestionCount even on visible categories.
  const tagRows = await db
    .select({
      categoryId: questionCategoriesTable.categoryId,
      questionId: questionCategoriesTable.questionId,
      published: quizzesTable.published,
    })
    .from(questionCategoriesTable)
    .innerJoin(questionsTable, eq(questionCategoriesTable.questionId, questionsTable.id))
    .innerJoin(quizzesTable, eq(questionsTable.quizId, quizzesTable.id));
  const directTags = new Map<number, Set<number>>();
  for (const row of tagRows) {
    if (!admin && !row.published) continue;
    const set = directTags.get(row.categoryId) ?? new Set<number>();
    set.add(row.questionId);
    directTags.set(row.categoryId, set);
  }

  // Descendant-inclusive distinct tagged-question count per category (matches
  // import-by-category, which pulls questions tagged with the category OR any
  // descendant). Computed in a single memoized post-order pass over the tree.
  const childrenByParent = new Map<number | null, number[]>();
  for (const c of categories) {
    const arr = childrenByParent.get(c.parentId) ?? [];
    arr.push(c.id);
    childrenByParent.set(c.parentId, arr);
  }
  const setCache = new Map<number, Set<number>>();
  const taggedQuestionSet = (id: number): Set<number> => {
    const cached = setCache.get(id);
    if (cached) return cached;
    const union = new Set<number>(directTags.get(id) ?? []);
    setCache.set(id, union); // set before recursing to guard against cycles
    for (const childId of childrenByParent.get(id) ?? []) {
      for (const q of taggedQuestionSet(childId)) union.add(q);
    }
    return union;
  };
  const taggedCountMap = new Map<number, number>();
  for (const c of categories) taggedCountMap.set(c.id, taggedQuestionSet(c.id).size);

  type Node = { id: number; name: string; slug: string; parentId: number | null; imageUrl: string | null; published: boolean; quizCount: number; taggedQuestionCount: number; children: Node[] };
  const nodes: Map<number, Node> = new Map();
  for (const c of categories) {
    nodes.set(c.id, {
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      imageUrl: c.imageUrl,
      published: c.published,
      quizCount: countMap.get(c.id) ?? 0,
      taggedQuestionCount: taggedCountMap.get(c.id) ?? 0,
      children: [],
    });
  }

  const roots: Node[] = [];
  for (const node of nodes.values()) {
    if (node.parentId !== null && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  res.json(roots);
});

router.get("/categories/by-slug/:slug", async (req, res): Promise<void> => {
  const admin = isRequestAdmin(req);
  const slug = String(req.params.slug);
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, slug));
  if (!category || (!category.published && !admin)) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const all = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  const byId = new Map(all.map((c) => [c.id, c]));

  // Non-admins may reach a directly-addressable page only when the category and
  // every ancestor is published. A published child of a draft parent is hidden.
  const isVisible = (c: typeof categoriesTable.$inferSelect) =>
    admin || isCategoryVisible(c, byId);
  if (!isVisible(category)) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  // Build ancestors chain (root → ... → parent)
  const ancestors: typeof all = [];
  let cursor: number | null = category.parentId;
  const visited = new Set<number>();
  while (cursor !== null) {
    if (visited.has(cursor)) break;
    visited.add(cursor);
    const c = byId.get(cursor);
    if (!c) break;
    ancestors.unshift(c);
    cursor = c.parentId;
  }

  // Collect descendants (BFS). Non-admins never see draft subtrees.
  const descendantIds = collectDescendantIds(category.id, all);
  const descendants = descendantIds
    .map((id) => byId.get(id)!)
    .filter((c) => c && isVisible(c));

  // Quizzes: this category + all visible descendants
  const visibleDescendantIds = descendants.map((c) => c.id);
  const includedCategoryIds = [category.id, ...visibleDescendantIds];
  const links = await db
    .select({ quizId: quizCategoriesTable.quizId })
    .from(quizCategoriesTable)
    .where(inArray(quizCategoriesTable.categoryId, includedCategoryIds));
  const quizIds = Array.from(new Set(links.map((l) => l.quizId)));

  let quizzes: any[] = [];
  if (quizIds.length > 0) {
    const allRows = await db.select().from(quizzesTable).where(inArray(quizzesTable.id, quizIds));
    // Non-admins only ever see published quizzes here.
    const rows = admin ? allRows : allRows.filter((q) => q.published);
    const counts = await db
      .select({ quizId: questionsTable.quizId, count: sql<number>`count(*)::int` })
      .from(questionsTable)
      .where(inArray(questionsTable.quizId, quizIds))
      .groupBy(questionsTable.quizId);
    const countMap = new Map(counts.map((c) => [c.quizId, c.count]));

    const quizCatLinks = await db
      .select()
      .from(quizCategoriesTable)
      .where(inArray(quizCategoriesTable.quizId, quizIds));
    const catsByQuiz = new Map<number, { id: number; name: string; slug: string }[]>();
    for (const link of quizCatLinks) {
      const c = byId.get(link.categoryId);
      if (!c) continue;
      if (!isVisible(c)) continue;
      const arr = catsByQuiz.get(link.quizId) ?? [];
      arr.push({ id: c.id, name: c.name, slug: c.slug });
      catsByQuiz.set(link.quizId, arr);
    }

    quizzes = rows.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      category: q.category,
      difficulty: q.difficulty,
      questionCount: countMap.get(q.id) ?? 0,
      categories: catsByQuiz.get(q.id) ?? [],
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    }));
    quizzes.sort((a, b) => a.title.localeCompare(b.title));
  }

  res.json({
    category: serializeCategory(category),
    ancestors: ancestors.map(serializeCategory),
    descendants: descendants.map(serializeCategory),
    quizzes,
  });
});

router.post("/categories", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, parentId, slug, published } = parsed.data;

  if (parentId !== null && parentId !== undefined) {
    const [parent] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, parentId));
    if (!parent) {
      res.status(400).json({ error: "Parent category does not exist" });
      return;
    }
  }

  const finalSlug = await uniqueSlug(slug ? slugify(slug) : slugify(name));

  const [created] = await db
    .insert(categoriesTable)
    .values({
      name,
      slug: finalSlug,
      parentId: parentId ?? null,
      ...(published !== undefined ? { published } : {}),
    })
    .returning();

  res.status(201).json(serializeCategory(created));
});

router.patch("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateCategoryParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, parentId, slug, published } = parsed.data;

  if (parentId === params.data.id) {
    res.status(400).json({ error: "Category cannot be its own parent" });
    return;
  }

  if (parentId !== null && parentId !== undefined) {
    const all = await db.select().from(categoriesTable);
    const byId = new Map(all.map((c) => [c.id, c]));
    let cursor: number | null = parentId;
    const visited = new Set<number>();
    while (cursor !== null) {
      if (cursor === params.data.id) {
        res.status(400).json({ error: "Cannot create a cycle in category hierarchy" });
        return;
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
  }

  const updateData: Partial<typeof categoriesTable.$inferInsert> = {};
  if (name !== undefined) updateData.name = name;
  if (parentId !== undefined) updateData.parentId = parentId;
  if (published !== undefined) updateData.published = published;
  if (slug !== undefined) {
    const desired = slugify(slug);
    if (!desired) {
      res.status(400).json({ error: "Slug cannot be empty" });
      return;
    }
    updateData.slug = await uniqueSlug(desired, params.data.id);
  }

  const [updated] = await db
    .update(categoriesTable)
    .set(updateData)
    .where(eq(categoriesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.json(serializeCategory(updated));
});

router.delete("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteCategoryParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(categoriesTable)
    .where(eq(categoriesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
