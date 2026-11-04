import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { auth, DISABLED_AUTH_PATHS } from "@/lib/auth/auth";
import { buildSessionCookie, createTestSession } from "@/lib/auth/test-auth";
import { resetDb } from "../helpers/db";

const ORIGIN = "http://localhost:3000";

async function loggedIn() {
  const { userId, sessionToken } = await createTestSession({ email: "aluno@unifei.edu.br", name: "Aluno" });
  const cookie = (await buildSessionCookie(sessionToken)).split(";")[0] as string;
  const call = (path: string, init: { method?: string; body?: unknown } = {}) =>
    auth.handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: init.method ?? "POST",
        headers: { "content-type": "application/json", cookie, origin: ORIGIN },
        body: init.method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
      }),
    );
  return { userId, call };
}

describe("endpoints do Better-Auth que o Vértice não usa", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
  });

  it("respondem 404 por POST e por GET", async () => {
    const { call } = await loggedIn();
    for (const path of DISABLED_AUTH_PATHS) {
      expect((await call(path)).status, `POST ${path}`).toBe(404);
      expect((await call(path, { method: "GET" })).status, `GET ${path}`).toBe(404);
    }
  });

  it("o aluno não consegue trocar nome nem foto, nem por variações do caminho", async () => {
    const { userId, call } = await loggedIn();
    const body = { name: "Coordenação UNIFEI (oficial)", image: "https://evil.example/x.png" };
    for (const path of ["/update-user", "/update-user/", "/UPDATE-USER", "/update-user?x=1", "//update-user"]) {
      expect((await call(path, { body })).status, path).not.toBe(200);
    }
    const [user] = await db.select({ name: users.name, image: users.image }).from(users).where(eq(users.id, userId));
    expect(user).toEqual({ name: "Aluno", image: null });
  });

  it("sessão e login com Google continuam disponíveis", async () => {
    const { call } = await loggedIn();
    const session = await call("/get-session", { method: "GET" });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ user: { email: "aluno@unifei.edu.br" } });
    const signIn = await call("/sign-in/social", { body: { provider: "google", callbackURL: "/painel" } });
    expect(signIn.status).toBe(200);
    expect(await signIn.json()).toMatchObject({ url: expect.stringContaining("accounts.google.com") });
  });
});
