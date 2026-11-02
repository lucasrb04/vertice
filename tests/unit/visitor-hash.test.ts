import { describe, expect, it } from "vitest";
import { getVisitorHashSecret, visitorHash } from "@/lib/public/telemetry";
import type { Env } from "@/env";

const env = (o: Partial<Env>) => o as Env;

describe("visitorHash", () => {
  const secret = "s".repeat(32);
  it("é estável, tem 64 hex e não contém o IP", () => {
    const a = visitorHash("203.0.113.9", "UA/1", secret);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(visitorHash("203.0.113.9", "UA/1", secret)).toBe(a);
    expect(a).not.toContain("203.0.113.9");
  });
  it("muda com IP, user-agent ou segredo", () => {
    const a = visitorHash("203.0.113.9", "UA/1", secret);
    expect(visitorHash("203.0.113.10", "UA/1", secret)).not.toBe(a);
    expect(visitorHash("203.0.113.9", "UA/2", secret)).not.toBe(a);
    expect(visitorHash("203.0.113.9", "UA/1", "t".repeat(32))).not.toBe(a);
  });
  it("aceita IP e UA nulos", () => {
    expect(visitorHash(null, null, secret)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("getVisitorHashSecret", () => {
  it("produção sem segredo falha", () => {
    expect(() => getVisitorHashSecret(env({ NODE_ENV: "production" }))).toThrow(/VISITOR_HASH_SECRET/);
  });
  it("produção com segredo curto falha", () => {
    expect(() => getVisitorHashSecret(env({ NODE_ENV: "production", VISITOR_HASH_SECRET: "curto" }))).toThrow();
  });
  it("produção usa o segredo configurado", () => {
    const s = "v".repeat(32);
    expect(getVisitorHashSecret(env({ NODE_ENV: "production", VISITOR_HASH_SECRET: s }))).toBe(s);
  });
  it("fora de produção cai num segredo fixo de desenvolvimento", () => {
    expect(getVisitorHashSecret(env({ NODE_ENV: "development" })).length).toBeGreaterThanOrEqual(32);
  });
});
