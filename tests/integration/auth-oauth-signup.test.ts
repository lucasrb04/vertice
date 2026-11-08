import { handleOAuthUserInfo } from "better-auth/oauth2";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { auth } from "@/lib/auth/auth";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";

/**
 * Caminho real do callback do Google para um usuário novo (handleOAuthUserInfo do Better-Auth), não só o
 * hook isolado. Em produção, `institutionId` com `required: true` quebrava aqui com MISSING_FIELD: o
 * Better-Auth valida os campos extras com os dados do Google antes de rodar o hook que os preenche.
 */
async function firstGoogleLogin(email: string) {
  const context = await auth.$context;
  return handleOAuthUserInfo({ context } as never, {
    userInfo: { id: `google-${email}`, email, emailVerified: true, name: "Aluno Teste", image: undefined },
    account: { providerId: "google", accountId: `google-${email}`, accessToken: "token-falso" },
    callbackURL: "/painel",
  });
}

describe("primeiro login com Google", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
  });

  it("cria o usuário @unifei.edu.br na instituição padrão", async () => {
    const result = await firstGoogleLogin("calouro@unifei.edu.br");
    expect(result.error).toBeFalsy();
    const [user] = await db.select().from(users).where(eq(users.email, "calouro@unifei.edu.br"));
    expect(user?.institutionId).toBe((await getDefaultInstitution()).id);
    expect(user?.systemRole).toBe("USER");
  });

  it("promove INITIAL_ADMIN_EMAIL a SYSTEM_ADMIN no primeiro login", async () => {
    // .env.test define INITIAL_ADMIN_EMAIL=admin@unifei.edu.br
    expect((await firstGoogleLogin("admin@unifei.edu.br")).error).toBeFalsy();
    const [user] = await db.select().from(users).where(eq(users.email, "admin@unifei.edu.br"));
    expect(user?.systemRole).toBe("SYSTEM_ADMIN");
  });

  it("continua recusando outro domínio pela política do Vértice, sem criar usuário", async () => {
    const outcome = await firstGoogleLogin("alguem@gmail.com").then(
      (r) => JSON.stringify(r.error),
      (e: { body?: { code?: string } }) => e.body?.code,
    );
    expect(outcome).toContain("DOMAIN_NOT_ALLOWED");
    expect(await db.select().from(users).where(eq(users.email, "alguem@gmail.com"))).toEqual([]);
  });
});
