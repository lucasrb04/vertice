import { describe, expect, it, vi } from "vitest";
import { parseEnv } from "@/env";
import {
  E2E_TURNSTILE_TOKEN,
  TURNSTILE_TEST_KEYS,
  getTurnstileConfig,
  verifyTurnstile,
} from "@/lib/security/turnstile";

const baseEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
};

const config = { siteKey: "site", secretKey: "sekret", bypass: false };
const fakeFetch = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("verifyTurnstile", () => {
  it("success:true → true e envia secret, response e remoteip", async () => {
    const f = fakeFetch({ success: true });
    await expect(verifyTurnstile("tok", "10.0.0.1", { fetch: f, config })).resolves.toBe(true);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("secret")).toBe("sekret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("10.0.0.1");
  });

  it("omite remoteip quando não há IP", async () => {
    const f = fakeFetch({ success: true });
    await verifyTurnstile("tok", null, { fetch: f, config });
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    expect(new URLSearchParams(String(init.body)).has("remoteip")).toBe(false);
  });

  it("success:false → false", async () => {
    await expect(verifyTurnstile("tok", null, { fetch: fakeFetch({ success: false }), config })).resolves.toBe(false);
  });

  it("fetch que rejeita → false", async () => {
    const f = vi.fn(async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch;
    await expect(verifyTurnstile("tok", null, { fetch: f, config })).resolves.toBe(false);
  });

  it("token vazio → false sem chamar fetch", async () => {
    const f = fakeFetch({ success: true });
    await expect(verifyTurnstile("", null, { fetch: f, config })).resolves.toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("bypass aceita só o token do E2E e não chama a rede", async () => {
    const f = fakeFetch({ success: true });
    const bypass = { ...config, bypass: true };
    await expect(verifyTurnstile(E2E_TURNSTILE_TOKEN, null, { fetch: f, config: bypass })).resolves.toBe(true);
    await expect(verifyTurnstile("outro", null, { fetch: f, config: bypass })).resolves.toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("getTurnstileConfig", () => {
  it("sem chaves em dev devolve as chaves de teste", () => {
    expect(getTurnstileConfig(parseEnv(baseEnv))).toEqual({ ...TURNSTILE_TEST_KEYS, bypass: false });
  });
  it("usa as chaves do env quando presentes", () => {
    const env = parseEnv({ ...baseEnv, TURNSTILE_SECRET_KEY: "s", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k" });
    expect(getTurnstileConfig(env)).toEqual({ siteKey: "k", secretKey: "s", bypass: false });
  });
  it("bypass com ENABLE_TEST_AUTH fora de produção", () => {
    expect(getTurnstileConfig(parseEnv({ ...baseEnv, ENABLE_TEST_AUTH: "true" })).bypass).toBe(true);
  });
});
