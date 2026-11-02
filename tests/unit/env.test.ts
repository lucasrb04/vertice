import { describe, it, expect } from "vitest";
import { parseEnv } from "@/env";

const base = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
};

describe("parseEnv", () => {
  it("aplica defaults", () => {
    const env = parseEnv(base);
    expect(env.DEFAULT_INSTITUTION_SLUG).toBe("unifei-itajuba");
    expect(env.ENABLE_TEST_AUTH).toBe(false);
  });
  it("converte ENABLE_TEST_AUTH='true' em boolean fora de produção", () => {
    expect(parseEnv({ ...base, ENABLE_TEST_AUTH: "true" }).ENABLE_TEST_AUTH).toBe(true);
  });
  it("recusa ENABLE_TEST_AUTH em produção", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production", ENABLE_TEST_AUTH: "true" }))
      .toThrow(/ENABLE_TEST_AUTH/);
  });
  it("aceita produção com ENABLE_TEST_AUTH=false", () => {
    const env = parseEnv({
      ...base,
      NODE_ENV: "production",
      ENABLE_TEST_AUTH: "false",
      TURNSTILE_SECRET_KEY: "s",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
      VISITOR_HASH_SECRET: "v".repeat(32),
      RESEND_API_KEY: "re_fake",
      EMAIL_FROM: "Vértice <a@example.com>",
    });
    expect(env.NODE_ENV).toBe("production");
    expect(env.ENABLE_TEST_AUTH).toBe(false);
  });
  it("recusa variável obrigatória ausente", () => {
    const rest: Record<string, string> = { ...base };
    delete rest.DATABASE_URL;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });
  it("recusa BETTER_AUTH_SECRET curto (< 32)", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "curto" })).toThrow(/BETTER_AUTH_SECRET/);
  });
  it("normaliza INITIAL_ADMIN_EMAIL para minúsculas", () => {
    expect(parseEnv({ ...base, INITIAL_ADMIN_EMAIL: "Admin@UNIFEI.edu.br" }).INITIAL_ADMIN_EMAIL)
      .toBe("admin@unifei.edu.br");
  });
  it("recusa produção sem as chaves do Turnstile", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow(
      /TURNSTILE_SECRET_KEY: obrigatório em produção/,
    );
    expect(() => parseEnv({ ...base, NODE_ENV: "production", TURNSTILE_SECRET_KEY: "s" })).toThrow(
      /NEXT_PUBLIC_TURNSTILE_SITE_KEY: obrigatório em produção/,
    );
  });
  it("aceita produção com as duas chaves do Turnstile", () => {
    const env = parseEnv({
      ...base,
      NODE_ENV: "production",
      TURNSTILE_SECRET_KEY: "s",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
      VISITOR_HASH_SECRET: "v".repeat(32),
      RESEND_API_KEY: "re_fake",
      EMAIL_FROM: "Vértice <a@example.com>",
    });
    expect(env.TURNSTILE_SECRET_KEY).toBe("s");
  });
  it("dev sem as chaves do Turnstile passa", () => {
    const env = parseEnv(base);
    expect(env.TURNSTILE_SECRET_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBeUndefined();
  });
  it("recusa produção sem VISITOR_HASH_SECRET", () => {
    const prod = { ...base, NODE_ENV: "production", TURNSTILE_SECRET_KEY: "s", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k" };
    expect(() => parseEnv(prod)).toThrow(/VISITOR_HASH_SECRET: obrigatório em produção/);
  });
  it("recusa VISITOR_HASH_SECRET curto", () => {
    expect(() => parseEnv({ ...base, VISITOR_HASH_SECRET: "curto" })).toThrow(/VISITOR_HASH_SECRET/);
  });
  it("dev sem VISITOR_HASH_SECRET passa", () => {
    expect(parseEnv(base).VISITOR_HASH_SECRET).toBeUndefined();
  });
});
