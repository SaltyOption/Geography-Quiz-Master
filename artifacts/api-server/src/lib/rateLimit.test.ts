import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request } from "express";
import { createRateLimiter, getRateLimitKey } from "./rateLimit";

describe("getRateLimitKey", () => {
  const makeReq = (ip: string | undefined, forwarded?: string): Request =>
    ({
      ip,
      headers: forwarded ? { "x-forwarded-for": forwarded } : {},
      socket: { remoteAddress: "10.0.0.1" },
    }) as unknown as Request;

  it("prefers the authenticated user id", () => {
    expect(getRateLimitKey(makeReq("1.2.3.4"), "user_1")).toBe("user:user_1");
  });

  it("uses req.ip, not the spoofable X-Forwarded-For header", () => {
    expect(getRateLimitKey(makeReq("1.2.3.4", "203.0.113.99"), null)).toBe("ip:1.2.3.4");
  });

  it("falls back to the socket address when req.ip is unset", () => {
    expect(getRateLimitKey(makeReq(undefined), null)).toBe("ip:10.0.0.1");
  });
});

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows max hits per window, then blocks", () => {
    const check = createRateLimiter({ windowMs: 1000, max: 3 });
    expect(check("a")).toBe(true);
    expect(check("a")).toBe(true);
    expect(check("a")).toBe(true);
    expect(check("a")).toBe(false);
    // Other keys are unaffected.
    expect(check("b")).toBe(true);
  });

  it("opens a fresh window after windowMs elapses", () => {
    const check = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(check("a")).toBe(true);
    expect(check("a")).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(check("a")).toBe(true);
  });

  it("keeps counting correctly across the periodic sweep", () => {
    const check = createRateLimiter({ windowMs: 1000, max: 2 });
    expect(check("a")).toBe(true);
    // Sweep fires on the next check after a full window; "a" is expired and
    // evicted, "fresh" starts a new window — both must still enforce limits.
    vi.advanceTimersByTime(1500);
    expect(check("fresh")).toBe(true);
    expect(check("a")).toBe(true);
    expect(check("a")).toBe(true);
    expect(check("a")).toBe(false);
  });
});
