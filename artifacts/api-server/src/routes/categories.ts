import { Router, type IRouter } from "express";
import { eq, sql, asc, isNull } from "drizzle-orm";
import { db, categoriesTable, quizCategoriesTable } from "@workspace/db";
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
  parentId: c.parentId,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

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

  type Node = { id: number; name: string; parentId: number | null; quizCount: number; children: Node[] };
  const nodes: Map<number, Node> = new Map();
  for (const c of categories) {
    nodes.set(c.id, {
      id: c.id,
      name: c.name,
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

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, parentId } = parsed.data;

  if (parentId !== null && parentId !== undefined) {
    const [parent] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, parentId));
    if (!parent) {
      res.status(400).json({ error: "Parent category does not exist" });
      return;
    }
  }

  const [created] = await db
    .insert(categoriesTable)
    .values({ name, parentId: parentId ?? null })
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

  const { name, parentId } = parsed.data;

  // Prevent self-parenting and cycles
  if (parentId === params.data.id) {
    res.status(400).json({ error: "Category cannot be its own parent" });
    return;
  }

  if (parentId !== null && parentId !== undefined) {
    // Walk up the parent chain to ensure parentId is not a descendant of this category
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
