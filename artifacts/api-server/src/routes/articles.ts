import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, articlesTable } from "@workspace/db";
import {
  CreateArticleBody,
  UpdateArticleBody,
  UpdateArticleParams,
  DeleteArticleParams,
  GetArticleParams,
} from "@workspace/api-zod";
import { requireAdmin, isRequestAdmin } from "../middlewares/requireAdmin";
import { slugify } from "../lib/categorySlug";
import { validateImageUrlReachable, imageValidationMessage } from "../lib/imageValidation";

const router: IRouter = Router();

async function uniqueArticleSlug(base: string, excludeId?: number): Promise<string> {
  const baseSlug = base || "article";
  let candidate = baseSlug;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db.select().from(articlesTable).where(eq(articlesTable.slug, candidate));
    const conflict = existing.find((a) => a.id !== excludeId);
    if (!conflict) return candidate;
    candidate = `${baseSlug}-${n++}`;
  }
}

const serializeArticle = (a: typeof articlesTable.$inferSelect) => ({
  id: a.id,
  title: a.title,
  slug: a.slug,
  summary: a.summary,
  body: a.body,
  imageUrl: a.imageUrl,
  published: a.published,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

const serializeArticleSummary = (a: typeof articlesTable.$inferSelect) => ({
  id: a.id,
  title: a.title,
  slug: a.slug,
  summary: a.summary,
  imageUrl: a.imageUrl,
  published: a.published,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

router.get("/articles", async (req, res): Promise<void> => {
  const admin = isRequestAdmin(req);
  const all = await db.select().from(articlesTable).orderBy(desc(articlesTable.createdAt));
  const rows = admin ? all : all.filter((a) => a.published);
  res.json(rows.map(serializeArticleSummary));
});

router.get("/articles/by-slug/:slug", async (req, res): Promise<void> => {
  const admin = isRequestAdmin(req);
  const slug = String(req.params.slug);
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.slug, slug));
  if (!article || (!article.published && !admin)) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(serializeArticle(article));
});

router.get("/articles/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetArticleParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [article] = await db
    .select()
    .from(articlesTable)
    .where(eq(articlesTable.id, params.data.id));
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(serializeArticle(article));
});

router.post("/articles", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, slug, summary, body, imageUrl, published } = parsed.data;
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    res.status(400).json({ error: "Title cannot be empty" });
    return;
  }
  if (!body.trim()) {
    res.status(400).json({ error: "Body cannot be empty" });
    return;
  }

  const imageError = await validateImageUrlReachable(imageUrl);
  if (imageError) {
    res.status(400).json({ error: imageValidationMessage(imageError) });
    return;
  }

  const finalSlug = await uniqueArticleSlug(slug ? slugify(slug) : slugify(trimmedTitle));

  const [created] = await db
    .insert(articlesTable)
    .values({
      title: trimmedTitle,
      slug: finalSlug,
      body,
      ...(summary !== undefined ? { summary } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(published !== undefined ? { published } : {}),
    })
    .returning();

  res.status(201).json(serializeArticle(created));
});

router.patch("/articles/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateArticleParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, slug, summary, body, imageUrl, published } = parsed.data;

  const imageError = await validateImageUrlReachable(imageUrl);
  if (imageError) {
    res.status(400).json({ error: imageValidationMessage(imageError) });
    return;
  }

  const updateData: Partial<typeof articlesTable.$inferInsert> = {};
  if (title !== undefined) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      res.status(400).json({ error: "Title cannot be empty" });
      return;
    }
    updateData.title = trimmedTitle;
  }
  if (body !== undefined) {
    if (!body.trim()) {
      res.status(400).json({ error: "Body cannot be empty" });
      return;
    }
    updateData.body = body;
  }
  if (summary !== undefined) updateData.summary = summary;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (published !== undefined) updateData.published = published;
  if (slug !== undefined) {
    const desired = slugify(slug);
    if (!desired) {
      res.status(400).json({ error: "Slug cannot be empty" });
      return;
    }
    updateData.slug = await uniqueArticleSlug(desired, params.data.id);
  }

  const [updated] = await db
    .update(articlesTable)
    .set(updateData)
    .where(eq(articlesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  res.json(serializeArticle(updated));
});

router.delete("/articles/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteArticleParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(articlesTable)
    .where(eq(articlesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
