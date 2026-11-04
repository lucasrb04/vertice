import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { ProjectRole } from "@/db/schema";
import { auditLogs, institutions, projectMembers, projects, users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError, UnauthorizedError } from "@/lib/auth/errors";
import { authorizeProjectRole, authorizeSystemAdmin, resolveActiveUser } from "@/lib/auth/guards";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";

type Fx = Awaited<ReturnType<typeof setup>>;

async function mkUser(institutionId: string, email: string, systemRole: "USER" | "SYSTEM_ADMIN" = "USER") {
  const [u] = await db
    .insert(users)
    .values({ institutionId, name: email, email, emailVerified: true, systemRole })
    .returning();
  return u!;
}

async function mkProject(institutionId: string, slug: string, status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  const [p] = await db
    .insert(projects)
    .values({
      institutionId,
      slug,
      name: slug,
      shortDescription: "d",
      category: "SCIENTIFIC_INIT",
      contactEmail: "c@unifei.edu.br",
      status,
    })
    .returning();
  return p!;
}

async function setup() {
  const inst = await getDefaultInstitution();
  const owner = await mkUser(inst.id, "owner@unifei.edu.br");
  const admin = await mkUser(inst.id, "admin@unifei.edu.br");
  const reviewer = await mkUser(inst.id, "reviewer@unifei.edu.br");
  const outsider = await mkUser(inst.id, "outsider@unifei.edu.br");
  const sysadmin = await mkUser(inst.id, "sysadmin@unifei.edu.br", "SYSTEM_ADMIN");
  const project = await mkProject(inst.id, "proj");
  const suspended = await mkProject(inst.id, "proj-susp", "SUSPENDED");
  await db.insert(projectMembers).values([
    { projectId: project.id, userId: owner.id, role: "OWNER" },
    { projectId: project.id, userId: admin.id, role: "ADMIN" },
    { projectId: project.id, userId: reviewer.id, role: "REVIEWER" },
    { projectId: suspended.id, userId: owner.id, role: "OWNER" },
  ]);
  const [foreignInst] = await db
    .insert(institutions)
    .values({ slug: "outra", name: "Outra", shortName: "OUT", allowedEmailDomains: ["outra.edu.br"] })
    .returning();
  const foreignOwner = await mkUser(foreignInst!.id, "dono@outra.edu.br");
  const foreignProject = await mkProject(foreignInst!.id, "estrangeiro");
  await db.insert(projectMembers).values([
    { projectId: foreignProject.id, userId: foreignOwner.id, role: "OWNER" },
    // usuário da UNIFEI inserido diretamente como membro do projeto estrangeiro
    { projectId: foreignProject.id, userId: outsider.id, role: "OWNER" },
  ]);
  return { inst, owner, admin, reviewer, outsider, sysadmin, project, suspended, foreignProject };
}

describe("guards", () => {
  let fx: Fx;
  beforeEach(async () => {
    await resetDb();
    await runSeed();
    fx = await setup();
  });

  describe("resolveActiveUser", () => {
    it("recusa sessão nula com NO_SESSION", async () => {
      await expect(resolveActiveUser(null)).rejects.toMatchObject({ reason: "NO_SESSION" });
      await expect(resolveActiveUser(null)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("recusa usuário banido com BANNED mesmo com sessão no banco", async () => {
      await db.update(users).set({ isBanned: true }).where(eq(users.id, fx.owner.id));
      await expect(resolveActiveUser({ id: fx.owner.id })).rejects.toMatchObject({ reason: "BANNED" });
    });

    it("relê do banco: banir depois de obter a sessão faz a próxima chamada falhar", async () => {
      const ok = await resolveActiveUser({ id: fx.owner.id });
      expect(ok.email).toBe("owner@unifei.edu.br");
      await db.update(users).set({ isBanned: true }).where(eq(users.id, fx.owner.id));
      await expect(resolveActiveUser({ id: fx.owner.id })).rejects.toMatchObject({ reason: "BANNED" });
    });
  });

  describe("authorizeProjectRole", () => {
    it.each<[string, ProjectRole[]]>([
      ["owner", ["OWNER"]],
      ["admin", ["OWNER", "ADMIN"]],
      ["reviewer", ["OWNER", "ADMIN", "REVIEWER"]],
    ])("%s passa com papéis %j e recebe membership.role", async (who, roles) => {
      const user = fx[who as "owner" | "admin" | "reviewer"];
      const access = await authorizeProjectRole(user, fx.project.id, roles);
      expect(access.membership?.role).toBe(who.toUpperCase());
      expect(access.project.id).toBe(fx.project.id);
      expect(access.user.id).toBe(user.id);
    });

    it("reviewer é recusado quando roles = ['OWNER','ADMIN']", async () => {
      await expect(authorizeProjectRole(fx.reviewer, fx.project.id, ["OWNER", "ADMIN"])).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("não-membro é recusado", async () => {
      await expect(authorizeProjectRole(fx.outsider, fx.project.id, ["OWNER"])).rejects.toBeInstanceOf(NotFoundError);
    });

    it("membro de projeto de outra instituição é recusado", async () => {
      await expect(authorizeProjectRole(fx.outsider, fx.foreignProject.id, ["OWNER"])).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("projectId inexistente e projectId sem permissão lançam o mesmo NotFoundError", async () => {
      const missing = await authorizeProjectRole(fx.outsider, "00000000-0000-4000-8000-000000000000", ["OWNER"]).catch(
        (e: unknown) => e,
      );
      const denied = await authorizeProjectRole(fx.outsider, fx.project.id, ["OWNER"]).catch((e: unknown) => e);
      expect(missing).toBeInstanceOf(NotFoundError);
      expect(denied).toBeInstanceOf(NotFoundError);
      expect((missing as Error).message).toBe((denied as Error).message);
    });

    it("projectId malformado ('abc', '1') lança NotFoundError sem erro do Postgres", async () => {
      for (const bad of ["abc", "1"]) {
        await expect(authorizeProjectRole(fx.owner, bad, ["OWNER"])).rejects.toBeInstanceOf(NotFoundError);
      }
    });

    it("projeto SUSPENDED: OWNER recusado por padrão e aceito com allowInactive", async () => {
      await expect(authorizeProjectRole(fx.owner, fx.suspended.id, ["OWNER"])).rejects.toBeInstanceOf(NotFoundError);
      const access = await authorizeProjectRole(fx.owner, fx.suspended.id, ["OWNER"], { allowInactive: true });
      expect(access.membership?.role).toBe("OWNER");
    });

    it("SYSTEM_ADMIN passa com membership null em projeto SUSPENDED e gera ADMIN_MAINTENANCE_ACCESS", async () => {
      const access = await authorizeProjectRole(fx.sysadmin, fx.suspended.id, ["OWNER"], { ipAddress: "10.0.0.1" });
      expect(access.membership).toBeNull();
      expect(access.project.id).toBe(fx.suspended.id);
      const logs = await db.select().from(auditLogs);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "ADMIN_MAINTENANCE_ACCESS",
        actorUserId: fx.sysadmin.id,
        targetType: "PROJECT",
        targetId: fx.suspended.id,
        institutionId: fx.inst.id,
        ipAddress: "10.0.0.1",
      });
    });

    it("SYSTEM_ADMIN não acessa projeto de outra instituição", async () => {
      await expect(authorizeProjectRole(fx.sysadmin, fx.foreignProject.id, ["OWNER"])).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("authorizeSystemAdmin", () => {
    const ctx = { path: "/admin/usuarios", ipAddress: "10.0.0.2" };

    it("SYSTEM_ADMIN passa sem auditoria", async () => {
      const u = await authorizeSystemAdmin(fx.sysadmin, ctx);
      expect(u.id).toBe(fx.sysadmin.id);
      expect(await db.select().from(auditLogs)).toHaveLength(0);
    });

    it("usuário comum recebe NotFoundError e gera 1 ADMIN_ACCESS_DENIED com metadata.path", async () => {
      await expect(authorizeSystemAdmin(fx.owner, ctx)).rejects.toBeInstanceOf(NotFoundError);
      const logs = await db.select().from(auditLogs);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "ADMIN_ACCESS_DENIED",
        actorUserId: fx.owner.id,
        targetType: "ROUTE",
        targetId: null,
        metadata: { path: "/admin/usuarios" },
        ipAddress: "10.0.0.2",
      });
    });

    it("anônimo (null) recebe NotFoundError e não gera auditoria", async () => {
      await expect(authorizeSystemAdmin(null, ctx)).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.select().from(auditLogs)).toHaveLength(0);
    });
  });
});
