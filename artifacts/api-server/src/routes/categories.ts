import { Router, type IRouter } from "express";
import { eq, sql, asc, inArray } from "drizzle-orm";
import { db, categoriesTable, quizCategoriesTable, quizzesTable, questionsTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  DeleteCategoryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const serializeCategory = (c: typeof categoriesTable.$inferSelect) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  parentId: c.parentId,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  const baseSlug = base || "category";
  let candidate = baseSlug;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, candidate));
    const conflict = existing.find((c) => c.id !== excludeId);
    if (!conflict) return candidate;
    candidate = `${baseSlug}-${n++}`;
  }
}

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  res.json(categories.map(serializeCategory));
});

router.get("/categories/tree", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));

  const counts = await db
    .select({ categoryId: quizCategoriesTable.categoryId, count: sql<number>`count(*)::int` })
    .from(quizCategoriesTable)
    .groupBy(quizCategoriesTable.categoryId);
  const countMap = new Map(counts.map((c) => [c.categoryId, c.count]));

  type Node = { id: number; name: string; slug: string; parentId: number | null; quizCount: number; children: Node[] };
  const nodes: Map<number, Node> = new Map();
  for (const c of categories) {
    nodes.set(c.id, {
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      quizCount: countMap.get(c.id) ?? 0,
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
  const slug = String(req.params.slug);
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, slug));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const all = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  const byId = new Map(all.map((c) => [c.id, c]));

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

  // Collect descendants (BFS)
  const descendantIds: number[] = [];
  const queue: number[] = [category.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const c of all) {
      if (c.parentId === id) {
        descendantIds.push(c.id);
        queue.push(c.id);
      }
    }
  }
  const descendants = descendantIds.map((id) => byId.get(id)!).filter(Boolean);

  // Quizzes: this category + all descendants
  const includedCategoryIds = [category.id, ...descendantIds];
  const links = await db
    .select({ quizId: quizCategoriesTable.quizId })
    .from(quizCategoriesTable)
    .where(inArray(quizCategoriesTable.categoryId, includedCategoryIds));
  const quizIds = Array.from(new Set(links.map((l) => l.quizId)));

  let quizzes: any[] = [];
  if (quizIds.length > 0) {
    const rows = await db.select().from(quizzesTable).where(inArray(quizzesTable.id, quizIds));
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

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, parentId, slug } = parsed.data;

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
    .values({ name, slug: finalSlug, parentId: parentId ?? null })
    .returning();

  res.status(201).json(serializeCategory(created));
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
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

  const { name, parentId, slug } = parsed.data;

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

router.delete("/categories/:id", async (req, res): Promise<void> => {
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
