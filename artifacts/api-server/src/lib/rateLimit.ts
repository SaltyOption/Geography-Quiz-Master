import type { Request } from "express";

/**
 * Derives a rate-limit bucket key for a request: the authenticated Clerk user
 * id when present, otherwise the caller's IP address. Uses `req.ip`, which
 * Express resolves through the `trust proxy` setting (see app.ts) — never the
 * raw X-Forwarded-For header, whose leftmost entries are client-controlled
 * and would let a caller mint a fresh bucket per request.
 */
export function getRateLimitKey(req: Request, userId: string | null): string {
  if (userId) return `user:${userId}`;
  return `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
}

/**
 * Creates a simple in-memory sliding-window rate limiter. Each call site gets
 * its own isolated counter map, so limits on different routes never interfere.
 * Returns a `check(key)` predicate that returns false once the key exceeds
 * `max` hits within `windowMs`.
 *
 * Expired entries are swept at most once per window, bounding the map to keys
 * seen within the last two windows rather than growing for the process
 * lifetime.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
}): (key: string) => boolean {
  const counters = new Map<string, { count: number; windowStart: number }>();
  let lastSweep = 0;
  return function check(key: string): boolean {
    const now = Date.now();
    if (now - lastSweep >= options.windowMs) {
      lastSweep = now;
      for (const [k, entry] of counters) {
        if (now - entry.windowStart >= options.windowMs) counters.delete(k);
      }
    }
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
