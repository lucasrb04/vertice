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
});
