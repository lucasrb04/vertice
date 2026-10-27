import { beforeEach, describe, it, expect } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { getDefaultInstitution } from "@/lib/tenant";
import { beforeUserCreate, beforeSessionCreate } from "@/lib/auth/hooks";
import { AuthPolicyError } from "@/lib/auth/errors";
import { resetDb } from "../helpers/db";

const code = (p: Promise<unknown>) => p.then(() => null, (e) => (e as AuthPolicyError).code);

describe("beforeUserCreate", () => {
  beforeEach(async () => { await resetDb(); await runSeed(); });

  it("aceita @unifei.edu.br verificado, normaliza e atribui a instituição padrão", async () => {
    const inst = await getDefaultInstitution();
    const out = await beforeUserCreate({ email: " Aluno@UNIFEI.edu.br ", emailVerified: true });
    expect(out).toEqual({ email: "aluno@unifei.edu.br", institutionId: inst.id, systemRole: "USER" });
  });
  it("recusa outro domínio", async () => {
    expect(await code(beforeUserCreate({ email: "a@gmail.com", emailVerified: true }))).toBe("DOMAIN_NOT_ALLOWED");
  });
  it("recusa sufixo parecido", async () => {
    expect(await code(beforeUserCreate({ email: "a@evilunifei.edu.br", emailVerified: true }))).toBe("DOMAIN_NOT_ALLOWED");
  });
  it("recusa e-mail não verificado", async () => {
    expect(await code(beforeUserCreate({ email: "a@unifei.edu.br", emailVerified: false }))).toBe("EMAIL_NOT_VERIFIED");
  });
  it("promove INITIAL_ADMIN_EMAIL no primeiro login", async () => {
    // .env.test define INITIAL_ADMIN_EMAIL=admin@unifei.edu.br
    const out = await beforeUserCreate({ email: "admin@unifei.edu.br", emailVerified: true });
    expect(out.systemRole).toBe("SYSTEM_ADMIN");
  });
});

describe("beforeSessionCreate", () => {
  beforeEach(async () => { await resetDb(); await runSeed(); });

  it("recusa usuário banido", async () => {
    const inst = await getDefaultInstitution();
    const [u] = await db.insert(users).values({ institutionId: inst.id, name: "B", email: "b@unifei.edu.br", emailVerified: true, isBanned: true }).returning();
    expect(await code(beforeSessionCreate({ userId: u.id }))).toBe("ACCOUNT_SUSPENDED");
  });
  it("aceita usuário ativo", async () => {
    const inst = await getDefaultInstitution();
    const [u] = await db.insert(users).values({ institutionId: inst.id, name: "A", email: "a@unifei.edu.br", emailVerified: true }).returning();
    await expect(beforeSessionCreate({ userId: u.id })).resolves.toBeUndefined();
  });
});
