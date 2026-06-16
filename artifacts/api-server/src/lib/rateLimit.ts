import type { Request } from "express";

/**
 * Derives a rate-limit bucket key for a request: the authenticated Clerk user
 * id when present, otherwise the caller's (proxy-forwarded) IP address.
 */
export function getRateLimitKey(req: Request, userId: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown");
  return `ip:${ip}`;
}

/**
 * Creates a simple in-memory sliding-window rate limiter. Each call site gets
 * its own isolated counter map, so limits on different routes never interfere.
 * Returns a `check(key)` predicate that returns false once the key exceeds
 * `max` hits within `windowMs`.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
}): (key: string) => boolean {
  const counters = new Map<string, { count: number; windowStart: number }>();
  return function check(key: string): boolean {
    const now = Date.now();
    const entry = counters.get(key);
    if (!entry || now - entry.windowStart >= options.windowMs) {
      counters.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= options.max) return false;
    entry.count += 1;
    return true;
  };
}
