import { beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, auditLogs, studentProfiles } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError } from "@/lib/auth/errors";
import { getBoard, moveApplications } from "@/lib/applications/board";
import { applyToOpportunity } from "@/lib/applications/service";
import type { ApplicationStatus } from "@/lib/applications/labels";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import { applicationLimiter } from "@/lib/security/rate-limit";
import { resetDb } from "../helpers/db";
import { addMember, mkCourse, mkForeignInstitution, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  await runSeed();
});

let seq = 0;

async function setup(projectStatus?: "ARCHIVED") {
  const project = await mkProject({ status: projectStatus });
  const opp = await mkOpportunity(project.id, { internalSelectionEnabled: true });
  const reviewer = await mkUser(`rev${seq++}@unifei.edu.br`);
  await addMember(project.id, reviewer.id, "REVIEWER");
  return { project, opp, reviewer };
}

async function apply(opportunityId: string, status: ApplicationStatus = "APPLIED") {
  const student = await mkUser(`aluno${seq++}@unifei.edu.br`);
  const [app] = await db.insert(applications).values({ opportunityId, userId: student.id, status }).returning();
  await db
    .insert(applicationEvents)
    .values({ applicationId: app.id, fromStatus: null, toStatus: "APPLIED", actorUserId: student.id });
  return { ...app, student };
}

const moveEvents = async (id: string) =>
  (await db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, id))).filter(
    (e) => e.fromStatus !== null,
  );
const statusOf = async (id: string) =>
  (await db.select({ status: applications.status }).from(applications).where(eq(applications.id, id)))[0]?.status;

describe("getBoard", () => {
  it("agrupa por etapa, na ordem das colunas, com perfil e histórico", async () => {
    const { project, opp, reviewer } = await setup();
    const a = await apply(opp.id);
    const b = await apply(opp.id, "INTERVIEW");
    const course = await mkCourse("CCO", "Ciência da Computação");
    await db.insert(studentProfiles).values({ userId: a.student.id, courseId: course.id, currentSemester: 5 });
    await db
      .update(applications)
      .set({ answerText: "Gosto de robôs.", externalProfileLink: "https://github.com/aluno" })
      .where(eq(applications.id, a.id));

    const board = await getBoard(reviewer, project.id, opp.id);

    expect(board.columns.map((c) => c.status)).toEqual(["APPLIED", "IN_REVIEW", "INTERVIEW", "ACCEPTED", "REJECTED"]);
    expect(board.columns[0].cards.map((c) => c.id)).toEqual([a.id]);
    expect(board.columns[2].cards.map((c) => c.id)).toEqual([b.id]);
    expect(board.columns[0].cards[0]).toMatchObject({
      status: "APPLIED",
      name: a.student.name,
      email: a.student.email,
      courseName: "Ciência da Computação",
      currentSemester: 5,
      answerText: "Gosto de robôs.",
      profileLink: "https://github.com/aluno",
    });
    expect(board.columns[0].cards[0].history).toMatchObject([{ toStatus: "APPLIED", message: null }]);
    expect(board.opportunity).toMatchObject({ id: opp.id, title: opp.title });
    expect(board.project).toMatchObject({ id: project.id, name: project.name });
    expect(board.canMove).toBe(true);
  });

  it("aluno sem perfil aparece sem curso e sem período", async () => {
    const { project, opp, reviewer } = await setup();
    await apply(opp.id);
    const board = await getBoard(reviewer, project.id, opp.id);
    expect(board.columns[0].cards[0]).toMatchObject({ courseName: null, currentSemester: null });
  });

  it("não traz candidatos de outro processo do projeto", async () => {
    const { project, opp, reviewer } = await setup();
    const other = await mkOpportunity(project.id, { internalSelectionEnabled: true });
    await apply(other.id);
    const board = await getBoard(reviewer, project.id, opp.id);
    expect(board.columns.flatMap((c) => c.cards)).toHaveLength(0);
  });

  it("não membro: NotFoundError", async () => {
    const { project, opp } = await setup();
    const outsider = await mkUser(`fora${seq++}@unifei.edu.br`);
    await expect(getBoard(outsider, project.id, opp.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("SYSTEM_ADMIN sem membership: NotFoundError, com o acesso auditado", async () => {
    const { project, opp } = await setup();
    const admin = await mkUser(`adm${seq++}@unifei.edu.br`, { systemRole: "SYSTEM_ADMIN" });
    await expect(getBoard(admin, project.id, opp.id)).rejects.toBeInstanceOf(NotFoundError);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.actorUserId, admin.id));
    expect(logs.map((l) => l.action)).toEqual(["ADMIN_MAINTENANCE_ACCESS"]);
  });

  it("SYSTEM_ADMIN com membership real entra", async () => {
    const { project, opp } = await setup();
    const admin = await mkUser(`adm${seq++}@unifei.edu.br`, { systemRole: "SYSTEM_ADMIN" });
    await addMember(project.id, admin.id, "REVIEWER");
    await expect(getBoard(admin, project.id, opp.id)).resolves.toMatchObject({ canMove: true });
  });

  it("processo de outro projeto ou id inválido: NotFoundError", async () => {
    const { project, reviewer } = await setup();
    const other = await mkProject();
    const foreign = await mkOpportunity(other.id, { internalSelectionEnabled: true });
    await expect(getBoard(reviewer, project.id, foreign.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getBoard(reviewer, project.id, "nao-uuid")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("projeto de outra instituição: NotFoundError, mesmo com membership", async () => {
    const inst = await mkForeignInstitution();
    const project = await mkProject({ institutionId: inst.id });
    const opp = await mkOpportunity(project.id);
    const user = await mkUser(`rev${seq++}@unifei.edu.br`);
    await addMember(project.id, user.id, "OWNER");
    await expect(getBoard(user, project.id, opp.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("projeto arquivado: lê, sem poder mover", async () => {
    const { project, opp, reviewer } = await setup("ARCHIVED");
    await apply(opp.id);
    const board = await getBoard(reviewer, project.id, opp.id);
    expect(board.canMove).toBe(false);
    expect(board.columns[0].cards).toHaveLength(1);
  });
});

describe("moveApplications", () => {
  const input = (
    ctx: { project: { id: string }; opp: { id: string } },
    apps: { id: string; status: ApplicationStatus }[],
    toStatus: ApplicationStatus,
    message?: string,
  ) => ({
    projectId: ctx.project.id,
    opportunityId: ctx.opp.id,
    items: apps.map((a) => ({ applicationId: a.id, fromStatus: a.status })),
    toStatus,
    message,
  });

  it("move um, grava evento, updatedByUserId e a mensagem", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id);
    const res = await moveApplications(ctx.reviewer, input(ctx, [a], "INTERVIEW", "  Entrevista dia 10.  "));

    expect(res).toEqual({
      moved: [{ applicationId: a.id, toStatus: "INTERVIEW", message: "Entrevista dia 10." }],
      skipped: 0,
    });
    const [row] = await db.select().from(applications).where(eq(applications.id, a.id));
    expect(row).toMatchObject({
      status: "INTERVIEW",
      updatedByUserId: ctx.reviewer.id,
      organizerFeedback: "Entrevista dia 10.",
    });
    expect(row.updatedAt.getTime()).toBeGreaterThanOrEqual(a.updatedAt.getTime());
    expect(await moveEvents(a.id)).toMatchObject([
      { fromStatus: "APPLIED", toStatus: "INTERVIEW", message: "Entrevista dia 10.", actorUserId: ctx.reviewer.id },
    ]);
  });

  it("move vários de etapas diferentes", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id);
    const b = await apply(ctx.opp.id, "IN_REVIEW");
    const res = await moveApplications(ctx.reviewer, input(ctx, [a, b], "ACCEPTED"));
    expect(res.skipped).toBe(0);
    expect(res.moved.map((m) => m.applicationId).sort()).toEqual([a.id, b.id].sort());
    expect(res.moved.every((m) => m.message === null)).toBe(true);
    expect(await statusOf(a.id)).toBe("ACCEPTED");
    expect(await statusOf(b.id)).toBe("ACCEPTED");
    expect(await moveEvents(b.id)).toMatchObject([{ fromStatus: "IN_REVIEW", toStatus: "ACCEPTED", message: null }]);
  });

  it("aceita voltar de etapa", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id, "REJECTED");
    await moveApplications(ctx.reviewer, input(ctx, [a], "APPLIED"));
    expect(await statusOf(a.id)).toBe("APPLIED");
  });

  it("movimento sem mensagem preserva a última mensagem em organizerFeedback", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id);
    await moveApplications(ctx.reviewer, input(ctx, [a], "IN_REVIEW", "Recebemos."));
    await moveApplications(ctx.reviewer, input(ctx, [{ id: a.id, status: "IN_REVIEW" }], "INTERVIEW", "   "));
    const [row] = await db.select().from(applications).where(eq(applications.id, a.id));
    expect(row.organizerFeedback).toBe("Recebemos.");
    expect((await moveEvents(a.id)).map((e) => e.message).sort()).toEqual(["Recebemos.", null].sort());
  });

  it("OWNER e ADMIN também movem", async () => {
    const ctx = await setup();
    for (const role of ["OWNER", "ADMIN"] as const) {
      const member = await mkUser(`m${seq++}@unifei.edu.br`);
      await addMember(ctx.project.id, member.id, role);
      const a = await apply(ctx.opp.id);
      const res = await moveApplications(member, input(ctx, [a], "IN_REVIEW"));
      expect(res.moved).toHaveLength(1);
    }
  });

  it("não membro e SYSTEM_ADMIN sem membership: NotFoundError, nada muda", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id);
    const outsider = await mkUser(`fora${seq++}@unifei.edu.br`);
    const admin = await mkUser(`adm${seq++}@unifei.edu.br`, { systemRole: "SYSTEM_ADMIN" });
    for (const user of [outsider, admin]) {
      await expect(moveApplications(user, input(ctx, [a], "ACCEPTED"))).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(await statusOf(a.id)).toBe("APPLIED");
    expect(await moveEvents(a.id)).toHaveLength(0);
  });

  it("projeto arquivado: DomainError, nada muda", async () => {
    const ctx = await setup("ARCHIVED");
    const a = await apply(ctx.opp.id);
    const err = await moveApplications(ctx.reviewer, input(ctx, [a], "INTERVIEW")).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe("PROJECT_READ_ONLY");
    expect(await statusOf(a.id)).toBe("APPLIED");
  });

  it("processo encerrado continua movendo", async () => {
    const project = await mkProject();
    const opp = await mkOpportunity(project.id, {
      internalSelectionEnabled: true,
      status: "CLOSED",
      closedAt: new Date(),
    });
    const reviewer = await mkUser(`rev${seq++}@unifei.edu.br`);
    await addMember(project.id, reviewer.id, "REVIEWER");
    const a = await apply(opp.id);
    const res = await moveApplications(reviewer, input({ project, opp }, [a], "ACCEPTED"));
    expect(res.moved).toHaveLength(1);
  });

  it("fromStatus antigo conta em skipped, sem evento", async () => {
    const ctx = await setup();
    const stale = await apply(ctx.opp.id, "IN_REVIEW");
    const fresh = await apply(ctx.opp.id);
    const res = await moveApplications(
      ctx.reviewer,
      input(ctx, [{ id: stale.id, status: "APPLIED" }, fresh], "INTERVIEW"),
    );
    expect(res.skipped).toBe(1);
    expect(res.moved.map((m) => m.applicationId)).toEqual([fresh.id]);
    expect(await statusOf(stale.id)).toBe("IN_REVIEW");
    expect(await moveEvents(stale.id)).toHaveLength(0);
  });

  it("id de outro processo ou inexistente conta em skipped e não muda nada", async () => {
    const ctx = await setup();
    const other = await mkOpportunity(ctx.project.id, { internalSelectionEnabled: true });
    const foreign = await apply(other.id);
    const res = await moveApplications(
      ctx.reviewer,
      input(ctx, [foreign, { id: crypto.randomUUID(), status: "APPLIED" }], "INTERVIEW"),
    );
    expect(res).toEqual({ moved: [], skipped: 2 });
    expect(await statusOf(foreign.id)).toBe("APPLIED");
    expect(await moveEvents(foreign.id)).toHaveLength(0);
  });

  it("mesma etapa de destino conta em skipped", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id, "INTERVIEW");
    const res = await moveApplications(ctx.reviewer, input(ctx, [a], "INTERVIEW", "Oi"));
    expect(res).toEqual({ moved: [], skipped: 1 });
    expect(await moveEvents(a.id)).toHaveLength(0);
    const [row] = await db.select().from(applications).where(eq(applications.id, a.id));
    expect(row.organizerFeedback).toBeNull();
    expect(row.updatedByUserId).toBeNull();
  });

  it("processo de outro projeto: NotFoundError, nada muda", async () => {
    const ctx = await setup();
    const otherProject = await mkProject();
    const foreign = await mkOpportunity(otherProject.id, { internalSelectionEnabled: true });
    const a = await apply(foreign.id);
    await expect(
      moveApplications(ctx.reviewer, input({ project: ctx.project, opp: foreign }, [a], "INTERVIEW")),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await statusOf(a.id)).toBe("APPLIED");
  });

  it("valida a entrada: 51 itens, nenhum, repetido, mensagem longa e etapa inválida", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id);
    const many = Array.from({ length: 51 }, () => ({ id: crypto.randomUUID(), status: "APPLIED" as const }));
    const bad = [
      input(ctx, many, "INTERVIEW"),
      input(ctx, [], "INTERVIEW"),
      input(ctx, [a, a], "INTERVIEW"),
      input(ctx, [a], "INTERVIEW", "x".repeat(2001)),
      { ...input(ctx, [a], "INTERVIEW"), toStatus: "CONTRATADO" as ApplicationStatus },
    ];
    for (const payload of bad) {
      await expect(moveApplications(ctx.reviewer, payload)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await statusOf(a.id)).toBe("APPLIED");
  });

  it("aceita 50 itens e mensagem de 2000 caracteres", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id);
    const fill = Array.from({ length: 49 }, () => ({ id: crypto.randomUUID(), status: "APPLIED" as const }));
    const res = await moveApplications(ctx.reviewer, input(ctx, [a, ...fill], "INTERVIEW", "x".repeat(2000)));
    expect(res.moved).toHaveLength(1);
    expect(res.skipped).toBe(49);
  });

  it("aluno se candidata, vira REVIEWER e não move a própria candidatura", async () => {
    const { project, opp } = await setup();
    applicationLimiter.reset();
    const student = await mkUser(`aluno${seq++}@unifei.edu.br`);
    const course = await mkCourse("CCO");
    const { applicationId } = await applyToOpportunity(student, {
      opportunitySlug: opp.slug,
      courseId: course.id,
      currentSemester: 4,
    });
    await addMember(project.id, student.id, "REVIEWER");
    const other = await apply(opp.id);

    // Ele continua vendo os concorrentes (D45), mas só o próprio card vem marcado.
    const board = await getBoard(student, project.id, opp.id);
    const cards = board.columns[0].cards;
    expect(cards.find((c) => c.id === applicationId)?.isOwn).toBe(true);
    expect(cards.find((c) => c.id === other.id)?.isOwn).toBe(false);

    const res = await moveApplications(student, {
      projectId: project.id,
      opportunityId: opp.id,
      items: [
        { applicationId, fromStatus: "APPLIED" },
        { applicationId: other.id, fromStatus: "APPLIED" },
      ],
      toStatus: "ACCEPTED",
    });

    expect(res).toEqual({ moved: [{ applicationId: other.id, toStatus: "ACCEPTED", message: null }], skipped: 1 });
    expect(await statusOf(applicationId)).toBe("APPLIED");
    expect(await moveEvents(applicationId)).toHaveLength(0);
    expect(await statusOf(other.id)).toBe("ACCEPTED");
  });

  it("movimentos concorrentes: só um vence, com um evento", async () => {
    const ctx = await setup();
    const a = await apply(ctx.opp.id);
    const b = await apply(ctx.opp.id);
    const [x, y] = await Promise.all([
      moveApplications(ctx.reviewer, input(ctx, [a, b], "INTERVIEW")),
      moveApplications(ctx.reviewer, input(ctx, [b, a], "REJECTED")),
    ]);
    expect(x.moved.length + y.moved.length).toBe(2);
    expect(x.skipped + y.skipped).toBe(2);
    const events = await db.select().from(applicationEvents).where(inArray(applicationEvents.applicationId, [a.id, b.id]));
    expect(events.filter((e) => e.fromStatus !== null)).toHaveLength(2);
  });

  it("movimento contra arquivamento concorrente nunca grava depois de arquivado", async () => {
    const ctx = await setup();
    const owner = await mkUser(`dono${seq++}@unifei.edu.br`);
    await addMember(ctx.project.id, owner.id, "OWNER");
    const a = await apply(ctx.opp.id);
    const { archiveProject } = await import("@/lib/projects/service");
    const [move] = await Promise.allSettled([
      moveApplications(ctx.reviewer, input(ctx, [a], "INTERVIEW")),
      archiveProject(owner, ctx.project.id),
    ]);
    const status = await statusOf(a.id);
    if (move.status === "rejected") {
      expect(move.reason).toBeInstanceOf(DomainError);
      expect(status).toBe("APPLIED");
    } else {
      expect(status).toBe("INTERVIEW");
    }
  });
});
