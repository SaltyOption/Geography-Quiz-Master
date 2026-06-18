import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, contactMessagesTable } from "@workspace/db";
import { SubmitContactMessageBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";
import { createRateLimiter, getRateLimitKey } from "../lib/rateLimit";

const router: IRouter = Router();

// Simple in-memory sliding-window rate limiter for the public contact form,
// keyed by authenticated userId (or remote IP for anonymous callers): 5
// submissions per 10-minute window per key. Bounds storage/abuse on this
// unauthenticated DB-write endpoint.
const checkRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
});

router.post("/contact", async (req, res): Promise<void> => {
  const parsed = SubmitContactMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = getAuth(req);
  const rateLimitKey = getRateLimitKey(req, auth?.userId ?? null);
  if (!checkRateLimit(rateLimitKey)) {
    res
      .status(429)
      .json({ error: "Too many messages. Please try again later." });
    return;
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim();
  const message = parsed.data.message.trim();
  const reason = parsed.data.reason ?? null;

  if (!name || !email || !message) {
    res.status(400).json({ error: "Name, email, and message are required." });
    return;
  }

  const [row] = await db
    .insert(contactMessagesTable)
    .values({ name, email, reason, message })
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
