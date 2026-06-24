import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, factoidsTable } from "@workspace/db";
import {
  CreateFactoidBody,
  UpdateFactoidBody,
  UpdateFactoidParams,
  DeleteFactoidParams,
} from "@workspace/api-zod";
import { isSafeHttpUrl } from "@workspace/markdown";
import { requireAdmin, isRequestAdmin } from "../middlewares/requireAdmin";

/**
 * Normalize an incoming sourceUrl: trim to null when empty, and reject any
 * non-http(s) scheme (javascript:, data:, etc.) so a stored URL can never become
 * a dangerous href on the public page. Returns { ok: true, value } on success or
 * { ok: false } when the URL must be rejected with a 400.
 */
function normalizeSourceUrl(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!isSafeHttpUrl(trimmed)) return { ok: false };
  return { ok: true, value: trimmed };
}

const router: IRouter = Router();

const serializeFactoid = (f: typeof factoidsTable.$inferSelect) => ({
  id: f.id,
  text: f.text,
  sourceLabel: f.sourceLabel,
  sourceUrl: f.sourceUrl,
  published: f.published,
  createdAt: f.createdAt.toISOString(),
  updatedAt: f.updatedAt.toISOString(),
});

router.get("/factoids", async (req, res): Promise<void> => {
  const admin = isRequestAdmin(req);
  const all = await db.select().from(factoidsTable).orderBy(desc(factoidsTable.createdAt));
  const rows = admin ? all : all.filter((f) => f.published);
  res.json(rows.map(serializeFactoid));
});

router.post("/factoids", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateFactoidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text, sourceLabel, sourceUrl, published } = parsed.data;
  const trimmed = text.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Factoid text cannot be empty" });
    return;
  }

  const normalizedUrl = normalizeSourceUrl(sourceUrl);
  if (!normalizedUrl.ok) {
    res.status(400).json({ error: "Source URL must be an http(s) link" });
    return;
  }

  const [created] = await db
    .insert(factoidsTable)
    .values({
      text: trimmed,
      ...(sourceLabel !== undefined ? { sourceLabel } : {}),
      ...(sourceUrl !== undefined ? { sourceUrl: normalizedUrl.value } : {}),
      ...(published !== undefined ? { published } : {}),
    })
    .returning();

  res.status(201).json(serializeFactoid(created));
});

router.patch("/factoids/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateFactoidParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFactoidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text, sourceLabel, sourceUrl, published } = parsed.data;
  const updateData: Partial<typeof factoidsTable.$inferInsert> = {};
  if (text !== undefined) {
    const trimmed = text.trim();
    if (!trimmed) {
      res.status(400).json({ error: "Factoid text cannot be empty" });
      return;
    }
    updateData.text = trimmed;
  }
  if (sourceLabel !== undefined) updateData.sourceLabel = sourceLabel;
  if (sourceUrl !== undefined) {
    const normalizedUrl = normalizeSourceUrl(sourceUrl);
    if (!normalizedUrl.ok) {
      res.status(400).json({ error: "Source URL must be an http(s) link" });
      return;
    }
    updateData.sourceUrl = normalizedUrl.value;
  }
  if (published !== undefined) updateData.published = published;

  const [updated] = await db
    .update(factoidsTable)
    .set(updateData)
    .where(eq(factoidsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Factoid not found" });
    return;
  }

  res.json(serializeFactoid(updated));
});

router.delete("/factoids/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteFactoidParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(factoidsTable)
    .where(eq(factoidsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Factoid not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
