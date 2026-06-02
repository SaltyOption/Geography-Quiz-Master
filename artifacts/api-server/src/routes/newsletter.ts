import { Router, type IRouter } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { asc } from "drizzle-orm";
import { db, newsletterSubscribersTable } from "@workspace/db";
import { UpdateNewsletterSubscriptionBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

async function getPrimaryEmail(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

router.get("/newsletter/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let email: string | null;
  try {
    email = await getPrimaryEmail(userId);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch user email from Clerk");
    res.status(502).json({ error: "Could not reach the authentication service" });
    return;
  }
  if (!email) {
    res.status(400).json({ error: "No email address on file" });
    return;
  }

  const [row] = await db
    .insert(newsletterSubscribersTable)
    .values({ userId, email })
    .onConflictDoUpdate({
      target: newsletterSubscribersTable.userId,
      set: { email, updatedAt: new Date() },
    })
    .returning();

  res.json({ email: row.email, subscribed: row.subscribed });
});

router.patch("/newsletter/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateNewsletterSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { subscribed } = parsed.data;

  let email: string | null;
  try {
    email = await getPrimaryEmail(userId);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch user email from Clerk");
    res.status(502).json({ error: "Could not reach the authentication service" });
    return;
  }
  if (!email) {
    res.status(400).json({ error: "No email address on file" });
    return;
  }

  const [row] = await db
    .insert(newsletterSubscribersTable)
    .values({ userId, email, subscribed })
    .onConflictDoUpdate({
      target: newsletterSubscribersTable.userId,
      set: { subscribed, email, updatedAt: new Date() },
    })
    .returning();

  res.json({ email: row.email, subscribed: row.subscribed });
});

router.get(
  "/newsletter/subscribers",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(newsletterSubscribersTable)
      .orderBy(asc(newsletterSubscribersTable.createdAt));

    const subscribed = rows.filter((r) => r.subscribed);
    res.json({
      subscribers: subscribed.map((r) => ({
        email: r.email,
        createdAt: r.createdAt.toISOString(),
      })),
      subscribedCount: subscribed.length,
      optedOutCount: rows.length - subscribed.length,
    });
  },
);

export default router;
