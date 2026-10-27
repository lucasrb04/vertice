import { afterEach, describe, expect, it, vi } from "vitest";

const RUNTIME_VARS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];

describe("acesso preguiçoso ao ambiente (spec §6.5: checagem no boot, não no build)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("importar @/db e @/lib/auth/auth sem variáveis de runtime não lê o ambiente", async () => {
    for (const name of RUNTIME_VARS) vi.stubEnv(name, undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_TEST_AUTH", "true");
    vi.resetModules();
    await expect(import("@/db")).resolves.toHaveProperty("db");
    await expect(import("@/lib/auth/auth")).resolves.toHaveProperty("auth");
  });

  it("o primeiro uso de db lê e valida o ambiente", async () => {
    for (const name of RUNTIME_VARS) vi.stubEnv(name, undefined);
    vi.resetModules();
    const { db } = await import("@/db");
    expect(() => db.select).toThrow(/Variáveis de ambiente inválidas/);
  });
});
