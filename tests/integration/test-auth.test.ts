import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { POST } from "@/app/api/test-auth/login/route";
import { auth } from "@/lib/auth/auth";
import { resetDb } from "../helpers/db";

const loginRequest = (body: unknown) =>
  new Request("http://localhost:3000/api/test-auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/test-auth/login", () => {
  beforeEach(async () => { await resetDb(); await runSeed(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("cria sessão para e-mail @unifei.edu.br e emite o cookie do Better-Auth", async () => {
    const res = await POST(loginRequest({ email: "aluno@unifei.edu.br", name: "Aluno" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("better-auth.session_token=");
    const [u] = await db.select().from(users).where(eq(users.email, "aluno@unifei.edu.br"));
    expect(u).toBeDefined();
    expect(await db.select().from(sessions)).toHaveLength(1);
  });

  it("emite um cookie que o Better-Auth aceita em getSession", async () => {
    const res = await POST(loginRequest({ email: "aluno@unifei.edu.br", name: "Aluno" }));
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const result = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(result?.user.email).toBe("aluno@unifei.edu.br");
    expect(result?.user.systemRole).toBe("USER");
  });

  it("recusa usuário banido com 403 ACCOUNT_SUSPENDED", async () => {
    await POST(loginRequest({ email: "b@unifei.edu.br", name: "B" }));
    await db.delete(sessions);
    await db.update(users).set({ isBanned: true }).where(eq(users.email, "b@unifei.edu.br"));
    const res = await POST(loginRequest({ email: "b@unifei.edu.br", name: "B" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "ACCOUNT_SUSPENDED" });
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("recusa outro domínio com 403 e não cria sessão", async () => {
    const res = await POST(loginRequest({ email: "a@gmail.com", name: "A" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "DOMAIN_NOT_ALLOWED" });
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("responde 400 para corpo inválido", async () => {
    const res = await POST(loginRequest({ email: 123 }));
    expect(res.status).toBe(400);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("responde 404 quando ENABLE_TEST_AUTH está desligado", async () => {
    vi.stubEnv("ENABLE_TEST_AUTH", "false");
    vi.resetModules();
    const { POST: freshPost } = await import("@/app/api/test-auth/login/route");
    const res = await freshPost(loginRequest({ email: "aluno@unifei.edu.br", name: "Aluno" }));
    expect(res.status).toBe(404);
  });
});
