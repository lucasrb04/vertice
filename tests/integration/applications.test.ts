import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, studentProfiles } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError } from "@/lib/auth/errors";
import { applyToOpportunity } from "@/lib/applications/service";
import { DomainError, RateLimitError, ValidationError } from "@/lib/domain-errors";
import { updateOpportunity } from "@/lib/opportunities/service";
import { applicationLimiter } from "@/lib/security/rate-limit";
import { resetDb } from "../helpers/db";
import { addMember, mkCourse, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";
import { validOpportunityInput } from "../helpers/inputs";

beforeEach(async () => {
  await resetDb();
  await runSeed();
  applicationLimiter.reset();
});

let seq = 0;
const DAY = 24 * 3_600_000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function setup(oppOverrides: Parameters<typeof mkOpportunity>[1] = {}) {
  const project = await mkProject();
  const opp = await mkOpportunity(project.id, { internalSelectionEnabled: true, ...oppOverrides });
  const student = await mkUser(`aluno${seq++}@unifei.edu.br`);
  const course = await mkCourse("CCO");
  const input = { opportunitySlug: opp.slug, courseId: course.id, currentSemester: 4 };
  return { project, opp, student, course, input };
}

const rows = (oppId: string) => db.select().from(applications).where(eq(applications.opportunityId, oppId));

describe("applyToOpportunity", () => {
  it("cria candidatura APPLIED, evento de criação e atualiza o perfil", async () => {
    const { opp, student, course, input } = await setup();
    const res = await applyToOpportunity(student, { ...input, profileLink: "https://github.com/aluno" });
    expect(res.opportunitySlug).toBe(opp.slug);

    const [app] = await rows(opp.id);
    expect(app).toMatchObject({
      id: res.applicationId,
      userId: student.id,
      status: "APPLIED",
      matchScoreSnapshot: null,
      externalProfileLink: "https://github.com/aluno",
    });
    const events = await db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, app.id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: null, toStatus: "APPLIED", actorUserId: student.id });

    const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, student.id));
    expect(profile).toMatchObject({ courseId: course.id, currentSemester: 4, githubUrl: "https://github.com/aluno" });
  });

  it("guarda a resposta quando há pergunta", async () => {
    const { opp, student, input } = await setup({ customQuestion: "Por que você?" });
    await applyToOpportunity(student, { ...input, answerText: "  Porque sim.  " });
    expect((await rows(opp.id))[0].answerText).toBe("Porque sim.");
  });

  it("sem resposta quando há pergunta: ValidationError, sem consumir o limite", async () => {
    const { opp, student, input } = await setup({ customQuestion: "Por que você?" });
    const err = await applyToOpportunity(student, input).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fieldErrors.answerText).toBeDefined();
    expect(await rows(opp.id)).toHaveLength(0);
  });

  it("valida curso, período e link", async () => {
    const { student, input } = await setup();
    for (const bad of [
      { currentSemester: 0 },
      { currentSemester: 13 },
      { courseId: "nao-uuid" },
      { profileLink: "http://x.com" },
    ]) {
      await expect(applyToOpportunity(student, { ...input, ...bad })).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("recusa curso de outra instituição", async () => {
    const { student, input } = await setup();
    await expect(
      applyToOpportunity(student, { ...input, courseId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("recusa processo encerrado, prazo vencido e projeto arquivado", async () => {
    for (const setupArgs of [
      { project: {}, opp: { status: "CLOSED" as const, closedAt: new Date() } },
      { project: {}, opp: { deadlineAt: new Date(Date.now() - DAY) } },
    ]) {
      const { opp, student, input } = await setup(setupArgs.opp);
      await expect(applyToOpportunity(student, input)).rejects.toBeInstanceOf(DomainError);
      expect(await rows(opp.id)).toHaveLength(0);
    }
    const archived = await mkProject({ status: "ARCHIVED" });
    const opp = await mkOpportunity(archived.id, { internalSelectionEnabled: true });
    const student = await mkUser("outro@unifei.edu.br");
    const course = await mkCourse("CCO");
    await expect(
      applyToOpportunity(student, { opportunitySlug: opp.slug, courseId: course.id, currentSemester: 3 }),
    ).rejects.toMatchObject({ code: "OPPORTUNITY_CLOSED" });
  });

  it("recusa antes da abertura", async () => {
    const { opp, student, input } = await setup({ applicationsOpenOn: day(3) });
    await expect(applyToOpportunity(student, input)).rejects.toMatchObject({ code: "NOT_OPEN_YET" });
    expect(await rows(opp.id)).toHaveLength(0);
  });

  it("recusa processo sem seleção pela plataforma", async () => {
    const { student, input } = await setup({ internalSelectionEnabled: false });
    await expect(applyToOpportunity(student, input)).rejects.toMatchObject({ code: "NO_INTERNAL_SELECTION" });
  });

  it("recusa aluno membro do projeto", async () => {
    const { project, student, input } = await setup();
    await addMember(project.id, student.id, "REVIEWER");
    await expect(applyToOpportunity(student, input)).rejects.toMatchObject({ code: "PROJECT_MEMBER" });
  });

  it("slug inexistente ou em revisão: NotFoundError", async () => {
    const { student, input } = await setup({ status: "UNDER_REVIEW" });
    await expect(applyToOpportunity(student, input)).rejects.toBeInstanceOf(NotFoundError);
    await expect(applyToOpportunity(student, { ...input, opportunitySlug: "nao-existe" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("candidatura repetida, inclusive concorrente, gera uma linha", async () => {
    const { opp, student, input } = await setup();
    const results = await Promise.allSettled([applyToOpportunity(student, input), applyToOpportunity(student, input)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(DomainError);
    expect(failed.reason.userMessage).toBe("Você já se candidatou a este processo.");
    expect(await rows(opp.id)).toHaveLength(1);
    await expect(applyToOpportunity(student, input)).rejects.toMatchObject({ code: "ALREADY_APPLIED" });
  });

  it("a 21ª candidatura em uma hora: RateLimitError", async () => {
    const student = await mkUser("rapido@unifei.edu.br");
    const course = await mkCourse("CCO");
    const project = await mkProject();
    for (let i = 0; i < 20; i++) {
      const opp = await mkOpportunity(project.id, { internalSelectionEnabled: true });
      await applyToOpportunity(student, { opportunitySlug: opp.slug, courseId: course.id, currentSemester: 2 });
    }
    const opp = await mkOpportunity(project.id, { internalSelectionEnabled: true });
    await expect(
      applyToOpportunity(student, { opportunitySlug: opp.slug, courseId: course.id, currentSemester: 2 }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("candidatura concorrente com desligar a seleção: ou a candidatura falha, ou o desligamento falha", async () => {
    const { project, opp, student, input } = await setup();
    const owner = await mkUser("dono@unifei.edu.br");
    await addMember(project.id, owner.id, "OWNER");
    const off = validOpportunityInput({ internalSelectionEnabled: false, externalUrl: "https://example.com/edital" });
    const [a, b] = await Promise.allSettled([
      applyToOpportunity(student, input),
      updateOpportunity(owner, project.id, opp.id, off),
    ]);
    const count = (await rows(opp.id)).length;
    const [fresh] = await db.query.opportunities.findMany({ where: (o, { eq }) => eq(o.id, opp.id) });
    // Nunca pode restar candidatura num processo com a seleção desligada.
    expect(count > 0 && !fresh.internalSelectionEnabled).toBe(false);
    expect([a.status, b.status].filter((s) => s === "fulfilled").length).toBeGreaterThanOrEqual(1);
  });
});
