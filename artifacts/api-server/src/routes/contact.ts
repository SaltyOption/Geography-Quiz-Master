import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, contactMessagesTable } from "@workspace/db";
import { SubmitContactMessageBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.post("/contact", async (req, res): Promise<void> => {
  const parsed = SubmitContactMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, reason, message } = parsed.data;

  const [row] = await db
    .insert(contactMessagesTable)
    .values({ name, email, reason: reason ?? null, message })
    .returning();

  res.status(201).json({ id: row.id });
});

router.get(
  "/contact/messages",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(contactMessagesTable)
      .orderBy(desc(contactMessagesTable.createdAt));

    res.json({
      messages: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        reason: r.reason,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
      })),
      total: rows.length,
    });
  },
);

export default router;
