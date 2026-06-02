import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const newsletterSubscribersTable = pgTable("newsletter_subscribers", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  subscribed: boolean("subscribed").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NewsletterSubscriber = typeof newsletterSubscribersTable.$inferSelect;
