import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, projectMembers } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError } from "@/lib/auth/errors";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import { MEMBER_NO_ACCOUNT, addMember as addMemberTo, changeMemberRole, leaveProject, removeMember } from "@/lib/projects/members";
import { resetDb } from "../helpers/db";
import { addMember, mkForeignInstitution, mkProject, mkUser } from "../helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  await runSeed();
});

async function setup() {
  const owner = await mkUser("owner@unifei.edu.br");
  const admin = await mkUser("admin@unifei.edu.br");
  const reviewer = await mkUser("rev@unifei.edu.br");
  const project = await mkProject();
  await addMember(project.id, owner.id, "OWNER");
  await addMember(project.id, admin.id, "ADMIN");
  await addMember(project.id, reviewer.id, "REVIEWER");
  return { owner, admin, reviewer, project };
}

const roleOf = async (projectId: string, userId: string) =>
  (await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))))[0]?.role;
const audits = async (action: string) => db.select().from(auditLogs).where(eq(auditLogs.action, action as never));

describe("members service", () => {
  it("OWNER adiciona ADMIN e REVIEWER por e-mail (case-insensitive)", async () => {
    const { owner, project } = await setup();
    const a = await mkUser("novo.admin@unifei.edu.br");
    const r = await mkUser("novo.rev@unifei.edu.br");
    await addMemberTo(owner, project.id, { email: "  Novo.Admin@UNIFEI.edu.br ", role: "ADMIN" });
    await addMemberTo(owner, project.id, { email: "novo.rev@unifei.edu.br", role: "REVIEWER" });
    expect(await roleOf(project.id, a.id)).toBe("ADMIN");
    expect(await roleOf(project.id, r.id)).toBe("REVIEWER");
    const logs = await audits("PROJECT_MEMBER_ADDED");
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ actorUserId: owner.id, targetType: "PROJECT", targetId: project.id, institutionId: project.institutionId });
    expect(logs.map((l) => l.metadata)).toContainEqual({ memberUserId: a.id, role: "ADMIN" });
  });

  it("já é membro -> ALREADY_MEMBER", async () => {
    const { owner, project } = await setup();
    await expect(addMemberTo(owner, project.id, { email: "rev@unifei.edu.br", role: "ADMIN" })).rejects.toMatchObject({ code: "ALREADY_MEMBER" });
  });

  it("e-mail sem conta, banido e de outra instituição recebem a mesma mensagem", async () => {
    const { owner, project } = await setup();
    await mkUser("banido@unifei.edu.br", { isBanned: true });
    const inst = await mkForeignInstitution();
    await mkUser("fora@outra.edu.br", { institutionId: inst.id });
    const errs: DomainError[] = [];
    for (const email of ["ninguem@unifei.edu.br", "banido@unifei.edu.br", "fora@outra.edu.br"]) {
      const err = await addMemberTo(owner, project.id, { email, role: "ADMIN" }).catch((e) => e);
      expect(err).toBeInstanceOf(DomainError);
      errs.push(err);
    }
    for (const e of errs) {
      expect(e.code).toBe("MEMBER_NO_ACCOUNT");
      expect(e.userMessage).toBe(MEMBER_NO_ACCOUNT);
    }
  });

  it("ADMIN e REVIEWER não gerenciam membros", async () => {
    const { admin, reviewer, project } = await setup();
    const t = await mkUser("t@unifei.edu.br");
    for (const u of [admin, reviewer]) {
      await expect(addMemberTo(u, project.id, { email: t.email, role: "ADMIN" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(changeMemberRole(u, project.id, reviewer.id, "ADMIN")).rejects.toBeInstanceOf(NotFoundError);
      await expect(removeMember(u, project.id, reviewer.id)).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("OWNER altera papel e remove membro com auditoria; não-membro e uuid inválido dão NotFoundError", async () => {
    const { owner, reviewer, project } = await setup();
    await changeMemberRole(owner, project.id, reviewer.id, "ADMIN");
    expect(await roleOf(project.id, reviewer.id)).toBe("ADMIN");
    expect((await audits("PROJECT_MEMBER_ROLE_CHANGED"))[0].metadata).toEqual({ memberUserId: reviewer.id, from: "REVIEWER", to: "ADMIN" });
    await removeMember(owner, project.id, reviewer.id);
    expect(await roleOf(project.id, reviewer.id)).toBeUndefined();
    expect(await audits("PROJECT_MEMBER_REMOVED")).toHaveLength(1);
    await expect(changeMemberRole(owner, project.id, reviewer.id, "ADMIN")).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeMember(owner, project.id, reviewer.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeMember(owner, project.id, "nao-e-uuid")).rejects.toBeInstanceOf(NotFoundError);
    await expect(changeMemberRole(owner, project.id, "nao-e-uuid", "ADMIN")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("OWNER não pode ser rebaixado, removido nem sair", async () => {
    const { owner, project } = await setup();
    await expect(changeMemberRole(owner, project.id, owner.id, "ADMIN")).rejects.toMatchObject({ code: "OWNER_IMMUTABLE" });
    await expect(removeMember(owner, project.id, owner.id)).rejects.toMatchObject({ code: "OWNER_IMMUTABLE" });
    await expect(leaveProject(owner, project.id)).rejects.toMatchObject({ code: "OWNER_IMMUTABLE", userMessage: "O dono do projeto não pode sair dele." });
    expect(await roleOf(project.id, owner.id)).toBe("OWNER");
  });

  it("REVIEWER sai do projeto", async () => {
    const { reviewer, project } = await setup();
    await leaveProject(reviewer, project.id);
    expect(await roleOf(project.id, reviewer.id)).toBeUndefined();
    const logs = await audits("PROJECT_MEMBER_LEFT");
    expect(logs).toHaveLength(1);
    expect(logs[0].actorUserId).toBe(reviewer.id);
  });

  it("papel OWNER não é atribuível", async () => {
    const { owner, project } = await setup();
    await mkUser("x@unifei.edu.br");
    await expect(addMemberTo(owner, project.id, { email: "x@unifei.edu.br", role: "OWNER" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("SYSTEM_ADMIN sem membership não gerencia membros", async () => {
    const { project, reviewer } = await setup();
    const sys = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    await expect(addMemberTo(sys, project.id, { email: "rev@unifei.edu.br", role: "ADMIN" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeMember(sys, project.id, reviewer.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
