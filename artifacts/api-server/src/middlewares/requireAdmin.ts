import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth } from "@clerk/express";

export function getAdminUserIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminUserIds().has(userId);
}

export const requireAdmin: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!isAdminUserId(userId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};
