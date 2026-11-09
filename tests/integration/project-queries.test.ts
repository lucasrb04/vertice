import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { type AuthUser, authorizeProjectRole } from "@/lib/auth/guards";
import { hideTarget } from "@/lib/moderation/service";
import {
  getProjectPanel,
  listCourses,
  listMembers,
  listMyProjects,
  listProjectsUserCanPublishIn,
} from "@/lib/projects/queries";
import { resetDb } from "../helpers/db";
import { addMember, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";

const H = 3_600_000;

describe("consultas do painel", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
  });

  it("getProjectPanel separa aberto, vencido e CLOSED e preenche closedOn", async () => {
    const user = (await mkUser("o@unifei.edu.br"))!;
    const project = (await mkProject())!;
    await addMember(project.id, user.id, "OWNER");
    const now = new Date();
    const open2 = (await mkOpportunity(project.id, {
      title: "Aberto B",
      deadlineAt: new Date(now.getTime() + 48 * H),
    }))!;
    const open1 = (await mkOpportunity(project.id, {
      title: "Aberto A",
      deadlineAt: new Date(now.getTime() + 24 * H),
    }))!;
    const expiredDeadline = new Date(now.getTime() - 48 * H);
    const expired = (await mkOpportunity(project.id, { title: "Vencido", deadlineAt: expiredDeadline }))!;
    const closedAt = new Date(now.getTime() - 2 * H);
    const closed = (await mkOpportunity(project.id, {
      title: "Encerrado",
      status: "CLOSED",
      closedAt,
      deadlineAt: new Date(now.getTime() + 72 * H),
    }))!;

    const access = await authorizeProjectRole(user as AuthUser, project.id, ["OWNER"]);
    const panel = await getProjectPanel(access, now);

    expect(panel.open.map((o) => o.id)).toEqual([open1.id, open2.id]);
    expect(panel.open.every((o) => o.closedOn === null)).toBe(true);
    expect(panel.closed.map((o) => o.id)).toEqual([closed.id, expired.id]);
    expect(panel.closed[0]!.closedOn).toEqual(closedAt);
    expect(panel.closed[1]!.closedOn).toEqual(expiredDeadline);
    expect(panel.open[0]).toMatchObject({ vacanciesCount: 1, hasExternalUrl: true, internalSelectionEnabled: false });
    expect(panel.open[0]!.slug).toBe(open1.slug);
    expect(panel.open[0]).toMatchObject({ views: 0, externalClicks: 0 });
  });

  it("getProjectPanel traz visualizações e cliques no edital de cada processo", async () => {
    const user = (await mkUser("o@unifei.edu.br"))!;
    const project = (await mkProject())!;
    await addMember(project.id, user.id, "OWNER");
    await mkOpportunity(project.id, {
      deadlineAt: new Date(Date.now() + 24 * H),
      viewsCount: 42,
      externalClicksCount: 7,
    });
    const panel = await getProjectPanel(await authorizeProjectRole(user as AuthUser, project.id, ["OWNER"]));
    expect(panel.open[0]).toMatchObject({ views: 42, externalClicks: 7 });
  });

  it("getProjectPanel conta candidatos em andamento, só para quem tem membership real", async () => {
    const owner = (await mkUser("dona@unifei.edu.br"))!;
    const project = (await mkProject())!;
    await addMember(project.id, owner.id, "OWNER");
    const opp = (await mkOpportunity(project.id))!;
    const closed = (await mkOpportunity(project.id, { status: "CLOSED", closedAt: new Date() }))!;
    const other = (await mkOpportunity((await mkProject())!.id))!;
    const statuses = ["APPLIED", "IN_REVIEW", "INTERVIEW", "ACCEPTED", "REJECTED"] as const;
    for (const [i, status] of statuses.entries()) {
      const student = (await mkUser(`a${i}@unifei.edu.br`))!;
      await db.insert(applications).values({ opportunityId: opp.id, userId: student.id, status });
      if (i === 0) await db.insert(applications).values({ opportunityId: closed.id, userId: student.id, status });
      if (i === 0) await db.insert(applications).values({ opportunityId: other.id, userId: student.id, status });
    }

    const panel = await getProjectPanel(await authorizeProjectRole(owner as AuthUser, project.id, ["OWNER"]));
    expect(panel.inProgressCount).toBe(4);

    const admin = (await mkUser("adm@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" }))!;
    const adminPanel = await getProjectPanel(await authorizeProjectRole(admin as AuthUser, project.id, ["OWNER"]));
    expect(adminPanel.inProgressCount).toBe(0);
  });

  it("getProjectPanel conta candidaturas só para quem tem membership real", async () => {
    const user = (await mkUser("o@unifei.edu.br"))!;
    const admin = (await mkUser("adm@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" }))!;
    const student = (await mkUser("aluno@unifei.edu.br"))!;
    const project = (await mkProject())!;
    await addMember(project.id, user.id, "REVIEWER");
    const withApp = (await mkOpportunity(project.id, { internalSelectionEnabled: true }))!;
    const empty = (await mkOpportunity(project.id, { internalSelectionEnabled: true }))!;
    await db.insert(applications).values({ opportunityId: withApp.id, userId: student.id });

    const panel = await getProjectPanel(await authorizeProjectRole(user as AuthUser, project.id, ["REVIEWER"]));
    const byId = new Map(panel.open.map((o) => [o.id, o.applicationsCount]));
    expect(byId.get(withApp.id)).toBe(1);
    expect(byId.get(empty.id)).toBe(0);

    const adminPanel = await getProjectPanel(await authorizeProjectRole(admin as AuthUser, project.id, ["OWNER"]));
    expect(adminPanel.open.every((o) => o.applicationsCount === 0)).toBe(true);
  });

  it("processo oculto vai para encerrados com o motivo; projeto oculto traz o motivo dele", async () => {
    const owner = (await mkUser("o@unifei.edu.br"))!;
    const admin = (await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" }))!;
    const project = (await mkProject())!;
    await addMember(project.id, owner.id, "OWNER");
    const hidden = (await mkOpportunity(project.id, { title: "Oculto" }))!;
    const open = (await mkOpportunity(project.id, { title: "Aberto" }))!;
    await hideTarget(admin as AuthUser, {
      targetType: "OPPORTUNITY",
      targetId: hidden.id,
      reason: "Bolsa anunciada não existe.",
    });

    let panel = await getProjectPanel(await authorizeProjectRole(owner as AuthUser, project.id, ["OWNER"]));
    expect(panel.open.map((o) => o.id)).toEqual([open.id]);
    expect(panel.open[0]).toMatchObject({ hidden: false, hiddenReason: null });
    expect(panel.closed.map((o) => o.id)).toEqual([hidden.id]);
    expect(panel.closed[0]).toMatchObject({ hidden: true, hiddenReason: "Bolsa anunciada não existe." });
    expect(panel.hiddenReason).toBeNull();

    await hideTarget(admin as AuthUser, {
      targetType: "PROJECT",
      targetId: project.id,
      reason: "Projeto fora das regras.",
    });
    panel = await getProjectPanel(
      await authorizeProjectRole(owner as AuthUser, project.id, ["OWNER"], { allowInactive: true }),
    );
    expect(panel.hiddenReason).toBe("Projeto fora das regras.");
    expect(panel.closed.find((o) => o.id === hidden.id)?.hiddenReason).toBe("Bolsa anunciada não existe.");
  });

  it("projeto arquivado: todos os processos caem em encerrados", async () => {
    const user = (await mkUser("o@unifei.edu.br"))!;
    const project = (await mkProject({ status: "ARCHIVED" }))!;
    await addMember(project.id, user.id, "OWNER");
    const o = (await mkOpportunity(project.id))!;
    const access = await authorizeProjectRole(user as AuthUser, project.id, ["OWNER"], { allowInactive: true });
    const panel = await getProjectPanel(access);
    expect(panel.open).toHaveLength(0);
    expect(panel.closed.map((x) => x.id)).toEqual([o.id]);
    expect(panel.closed[0]!.closedOn).toBeNull();
  });

  it("listMyProjects não mostra projeto de que o usuário não é membro", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    const mine = (await mkProject({ name: "Meu" }))!;
    await mkProject({ name: "Alheio" });
    await addMember(mine.id, user.id, "REVIEWER");
    const list = await listMyProjects(user as AuthUser);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: mine.id, name: "Meu", role: "REVIEWER", status: "ACTIVE" });
  });

  it("listMyProjects traz zeros sem processos e soma os números de todos os processos do projeto", async () => {
    const user = (await mkUser("dono@unifei.edu.br"))!;
    const empty = (await mkProject({ name: "A vazio" }))!;
    const busy = (await mkProject({ name: "B movimentado" }))!;
    await addMember(empty.id, user.id, "OWNER");
    await addMember(busy.id, user.id, "ADMIN");
    const now = Date.now();
    const open = (await mkOpportunity(busy.id, {
      deadlineAt: new Date(now + 48 * H),
      viewsCount: 10,
      externalClicksCount: 3,
    }))!;
    const expired = (await mkOpportunity(busy.id, {
      deadlineAt: new Date(now - 48 * H),
      viewsCount: 5,
      externalClicksCount: 1,
    }))!;
    await mkOpportunity(busy.id, { status: "CLOSED", deadlineAt: new Date(now + 48 * H), viewsCount: 2 });
    let n = 0;
    for (const [oppId, status] of [
      [open.id, "APPLIED"],
      [open.id, "INTERVIEW"],
      [open.id, "ACCEPTED"],
      [expired.id, "IN_REVIEW"],
      [expired.id, "REJECTED"],
    ] as const) {
      const student = (await mkUser(`aluno${n++}@unifei.edu.br`))!;
      await db.insert(applications).values({ opportunityId: oppId, userId: student.id, status });
    }

    const list = await listMyProjects(user as AuthUser);
    expect(list.map((p) => [p.name, p.stats])).toEqual([
      ["A vazio", { openOpportunities: 0, inProgressApplications: 0, views: 0, externalClicks: 0 }],
      ["B movimentado", { openOpportunities: 1, inProgressApplications: 3, views: 17, externalClicks: 4 }],
    ]);
  });

  it("listProjectsUserCanPublishIn exclui REVIEWER e projeto ARCHIVED", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    const owner = (await mkProject({ name: "Dono" }))!;
    const admin = (await mkProject({ name: "Admin" }))!;
    const reviewer = (await mkProject({ name: "Revisor" }))!;
    const archived = (await mkProject({ name: "Arquivado", status: "ARCHIVED" }))!;
    await addMember(owner.id, user.id, "OWNER");
    await addMember(admin.id, user.id, "ADMIN");
    await addMember(reviewer.id, user.id, "REVIEWER");
    await addMember(archived.id, user.id, "OWNER");
    const list = await listProjectsUserCanPublishIn(user as AuthUser);
    expect(list.map((p) => p.name)).toEqual(["Admin", "Dono"]);
  });

  it("listMembers coloca o OWNER primeiro e listCourses ordena por nome", async () => {
    const owner = (await mkUser("z-owner@unifei.edu.br"))!;
    const other = (await mkUser("a-admin@unifei.edu.br"))!;
    const project = (await mkProject())!;
    await addMember(project.id, other.id, "ADMIN");
    await addMember(project.id, owner.id, "OWNER");
    const access = await authorizeProjectRole(owner as AuthUser, project.id, ["OWNER"]);
    const members = await listMembers(access);
    expect(members.map((m) => m.role)).toEqual(["OWNER", "ADMIN"]);
    expect(members[0]).toMatchObject({ userId: owner.id, email: "z-owner@unifei.edu.br" });

    const courses = await listCourses(owner.institutionId);
    expect(courses.length).toBeGreaterThan(0);
    const names = courses.map((c) => c.name);
    expect(names[0]).toBe("Administração");
    expect(names).toEqual([...names].sort());
  });
});
