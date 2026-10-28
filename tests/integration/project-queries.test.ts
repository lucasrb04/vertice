import { beforeEach, describe, expect, it } from "vitest";
import { getProjectPanel, listCourses, listMembers, listMyProjects, listProjectsUserCanPublishIn } from "@/lib/projects/queries";
import { authorizeProjectRole, type AuthUser } from "@/lib/auth/guards";
import { runSeed } from "@/db/seed";
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
    const open2 = (await mkOpportunity(project.id, { title: "Aberto B", deadlineAt: new Date(now.getTime() + 48 * H) }))!;
    const open1 = (await mkOpportunity(project.id, { title: "Aberto A", deadlineAt: new Date(now.getTime() + 24 * H) }))!;
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
