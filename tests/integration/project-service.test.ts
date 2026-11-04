import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, type Tx } from "@/db";
import { auditLogs, opportunities, projectMembers, projects, tags } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError } from "@/lib/auth/errors";
import { DomainError, RateLimitError, ValidationError } from "@/lib/domain-errors";
import {
  archiveProject,
  createProjectWithOpportunity,
  PROJECT_NOT_ACTIVE,
  PROJECT_RATE_LIMIT,
  updateProject,
} from "@/lib/projects/service";
import { tagCreationLimiter } from "@/lib/security/rate-limit";
import { slugify } from "@/lib/slug";
import { deadlineFromDay } from "@/lib/time";
import { resetDb } from "../helpers/db";
import { addMember, mkForeignInstitution, mkProject, mkUser } from "../helpers/fixtures";
import { validOpportunityInput, validProjectInput } from "../helpers/inputs";
import { raceUnderProjectLock } from "../helpers/locks";

beforeEach(async () => {
  await resetDb();
  await runSeed();
  tagCreationLimiter.reset();
});

const wizard = (project = validProjectInput(), opportunity = validOpportunityInput()) => ({ project, opportunity });

describe("createProjectWithOpportunity", () => {
  it("wizard cria projeto, OWNER, processo e tags", async () => {
    const user = await mkUser("a@unifei.edu.br");
    const input = wizard(
      undefined,
      validOpportunityInput({ tags: { THEME: [{ name: "Robótica" }], DESIRED_SKILL: [], DEVELOPED_SKILL: [] } }),
    );
    const { projectId, opportunityId } = await createProjectWithOpportunity(user, input);

    const members = await db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId: user.id, role: "OWNER" });
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId));
    expect(opp.deadlineAt.getTime()).toBe(deadlineFromDay(input.opportunity.deadline).getTime());
    expect(opp.projectId).toBe(projectId);
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    expect(project.slug).toBe(slugify(input.project.name, 90));
    expect(project.institutionId).toBe(user.institutionId);
    expect(await db.select().from(tags).where(eq(tags.name, "Robótica"))).toHaveLength(1);
  });

  it("falha no meio não deixa nada gravado", async () => {
    const user = await mkUser("a@unifei.edu.br");
    const input = wizard(
      undefined,
      validOpportunityInput({
        targetCourseIds: [crypto.randomUUID()],
        tags: { THEME: [{ name: "Nova tag" }], DESIRED_SKILL: [], DEVELOPED_SKILL: [] },
      }),
    );
    const tagsBefore = await db.select().from(tags);
    await expect(createProjectWithOpportunity(user, input)).rejects.toBeInstanceOf(ValidationError);
    expect(await db.select().from(projects)).toHaveLength(0);
    expect(await db.select().from(projectMembers)).toHaveLength(0);
    expect(await db.select().from(opportunities)).toHaveLength(0);
    expect(await db.select().from(tags)).toHaveLength(tagsBefore.length);
  });

  it("entrada inválida vira ValidationError", async () => {
    const user = await mkUser("a@unifei.edu.br");
    await expect(createProjectWithOpportunity(user, { project: {}, opportunity: {} })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("dois projetos com o mesmo nome recebem slugs -2", async () => {
    const user = await mkUser("a@unifei.edu.br");
    const input = wizard(validProjectInput({ name: "Equipe Baja" }));
    const a = await createProjectWithOpportunity(user, input);
    const b = await createProjectWithOpportunity(user, input);
    const rows = await db.select({ id: projects.id, slug: projects.slug }).from(projects);
    expect(rows.find((r) => r.id === a.projectId)?.slug).toBe("equipe-baja");
    expect(rows.find((r) => r.id === b.projectId)?.slug).toBe("equipe-baja-2");
  });

  it("quarto projeto em 24h é recusado", async () => {
    const user = await mkUser("a@unifei.edu.br");
    for (let i = 0; i < 3; i++)
      await createProjectWithOpportunity(user, wizard(validProjectInput({ name: `Projeto ${i} X` })));
    const err = await createProjectWithOpportunity(user, wizard()).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.userMessage).toBe(PROJECT_RATE_LIMIT);
    expect(await db.select().from(projects)).toHaveLength(3);

    // 25h depois, os projetos antigos saem da janela.
    const now = new Date(Date.now() + 25 * 3_600_000);
    await db.update(projects).set({ createdAt: new Date(Date.now() - 1000) });
    await expect(createProjectWithOpportunity(user, wizard(), { now })).resolves.toBeTruthy();
  });

  it("membership não-OWNER não conta para o limite", async () => {
    const user = await mkUser("a@unifei.edu.br");
    for (let i = 0; i < 3; i++) {
      const p = await mkProject();
      await addMember(p.id, user.id, "ADMIN");
    }
    await expect(createProjectWithOpportunity(user, wizard())).resolves.toBeTruthy();
  });
});

describe("updateProject / archiveProject", () => {
  async function setup() {
    const owner = await mkUser("owner@unifei.edu.br");
    const admin = await mkUser("admin@unifei.edu.br");
    const reviewer = await mkUser("rev@unifei.edu.br");
    const outsider = await mkUser("out@unifei.edu.br");
    const sysadmin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const foreignInst = await mkForeignInstitution();
    const foreign = await mkUser("x@outra.edu.br", { institutionId: foreignInst.id });
    const project = await mkProject({ name: "Nome Antigo" });
    await addMember(project.id, owner.id, "OWNER");
    await addMember(project.id, admin.id, "ADMIN");
    await addMember(project.id, reviewer.id, "REVIEWER");
    return { owner, admin, reviewer, outsider, sysadmin, foreign, project };
  }

  it("OWNER e ADMIN editam; demais recebem NotFoundError; slug não muda", async () => {
    const s = await setup();
    await updateProject(s.owner, s.project.id, validProjectInput({ name: "Nome Novo Um" }));
    let [row] = await db.select().from(projects).where(eq(projects.id, s.project.id));
    expect(row.name).toBe("Nome Novo Um");
    expect(row.slug).toBe(s.project.slug);
    expect(row.status).toBe("ACTIVE");
    expect(row.updatedAt.getTime()).toBeGreaterThan(s.project.updatedAt.getTime() - 1);

    await updateProject(s.admin, s.project.id, validProjectInput({ name: "Nome Novo Dois" }));
    [row] = await db.select().from(projects).where(eq(projects.id, s.project.id));
    expect(row.name).toBe("Nome Novo Dois");

    for (const u of [s.reviewer, s.outsider, s.foreign, s.sysadmin]) {
      await expect(updateProject(u, s.project.id, validProjectInput())).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("entrada inválida em updateProject vira ValidationError", async () => {
    const s = await setup();
    await expect(updateProject(s.owner, s.project.id, { name: "" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("archiveProject: só OWNER; ADMIN recebe NotFoundError; auditoria; depois updateProject recusa", async () => {
    const s = await setup();
    await expect(archiveProject(s.admin, s.project.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(archiveProject(s.sysadmin, s.project.id)).rejects.toBeInstanceOf(NotFoundError);
    await archiveProject(s.owner, s.project.id);

    const [row] = await db.select().from(projects).where(eq(projects.id, s.project.id));
    expect(row.status).toBe("ARCHIVED");
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "PROJECT_ARCHIVED"), eq(auditLogs.targetId, s.project.id)));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      targetType: "PROJECT",
      actorUserId: s.owner.id,
      institutionId: s.project.institutionId,
    });

    await expect(updateProject(s.owner, s.project.id, validProjectInput())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("projeto SUSPENDED recusa updateProject mesmo para o OWNER", async () => {
    const owner = await mkUser("owner@unifei.edu.br");
    const project = await mkProject({ status: "SUSPENDED" });
    await addMember(project.id, owner.id, "OWNER");
    await expect(updateProject(owner, project.id, validProjectInput())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("SYSTEM_ADMIN com membership real escreve; com REVIEWER não", async () => {
    const sys = await mkUser("sys2@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const { projectId } = await createProjectWithOpportunity(sys, wizard());
    await updateProject(sys, projectId, validProjectInput({ name: "Editado Pelo Admin" }));
    const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
    expect(row.name).toBe("Editado Pelo Admin");

    const other = await mkProject();
    await addMember(other.id, sys.id, "REVIEWER");
    await expect(updateProject(sys, other.id, validProjectInput())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ocultação concorrente", () => {
  /** O que `hideTarget` grava num projeto ativo, feito sob a trava que ele também toma. */
  const suspend = (projectId: string) => async (tx: Tx) => {
    await tx
      .update(projects)
      .set({ status: "SUSPENDED", statusBeforeModeration: "ACTIVE" })
      .where(eq(projects.id, projectId));
  };

  async function setup() {
    const owner = await mkUser("owner@unifei.edu.br");
    const project = await mkProject({ name: "Nome Antigo" });
    await addMember(project.id, owner.id, "OWNER");
    return { owner, project };
  }

  it("archiveProject: ocultado entre a checagem e a gravação, DomainError e o projeto continua oculto", async () => {
    const { owner, project } = await setup();
    const result = await raceUnderProjectLock(project.id, () => archiveProject(owner, project.id), suspend(project.id));

    expect(result.status).toBe("rejected");
    const reason = (result as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(DomainError);
    expect(reason.userMessage).toBe(PROJECT_NOT_ACTIVE);
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row.status).toBe("SUSPENDED");
    expect(row.statusBeforeModeration).toBe("ACTIVE");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "PROJECT_ARCHIVED"));
    expect(logs).toHaveLength(0);
  });

  it("updateProject: ocultado entre a checagem e a gravação, DomainError e nada muda", async () => {
    const { owner, project } = await setup();
    const result = await raceUnderProjectLock(
      project.id,
      () => updateProject(owner, project.id, validProjectInput({ name: "Nome Novo" })),
      suspend(project.id),
    );

    expect(result.status).toBe("rejected");
    expect((result as PromiseRejectedResult).reason).toBeInstanceOf(DomainError);
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row.name).toBe("Nome Antigo");
    expect(row.status).toBe("SUSPENDED");
  });
});
