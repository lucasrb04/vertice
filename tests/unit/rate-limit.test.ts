import { afterEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "@/lib/security/rate-limit";

describe("createRateLimiter", () => {
  afterEach(() => vi.useRealTimers());

  it("bloqueia após o limite", () => {
    const l = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect([l.consume("u"), l.consume("u"), l.consume("u"), l.consume("u")]).toEqual([true, true, true, false]);
  });

  it("respeita a quantidade", () => {
    const l = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(l.consume("u", 2)).toBe(true);
    expect(l.consume("u", 2)).toBe(false);
    expect(l.consume("u", 1)).toBe(true);
  });

  it("volta a aceitar após a janela", () => {
    vi.useFakeTimers();
    const l = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(l.consume("u")).toBe(true);
    expect(l.consume("u")).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(l.consume("u")).toBe(true);
  });

  it("reset zera", () => {
    const l = createRateLimiter({ limit: 1, windowMs: 1000 });
    l.consume("u");
    l.reset();
    expect(l.consume("u")).toBe(true);
  });

  it("descarta a chave mais antiga acima de maxKeys", () => {
    const l = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
    l.consume("a");
    l.consume("b");
    l.consume("c");
    expect(l.consume("a")).toBe(true);
  });
});
