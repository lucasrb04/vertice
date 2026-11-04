import { render } from "@react-email/render";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditLogs, opportunities, projects, reports, searchVocabulary } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { DomainError, RateLimitError, ValidationError } from "@/lib/domain-errors";
import { hideTarget, REPORT_THRESHOLD } from "@/lib/moderation/service";
import { rebuildSearchVocabulary, refreshProjectSearchDocuments } from "@/lib/search/index-documents";
import { reportLimiter } from "@/lib/security/rate-limit";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import { addMember, mkForeignInstitution, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";

type Sent = { to: string; subject: string; react: Parameters<typeof render>[0] };
const sent: Sent[] = [];
const batches: number[] = [];
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (input: Sent) => {
    sent.push(input);
    return true;
  }),
  sendEmailBatch: vi.fn(async (inputs: Sent[]) => {
    batches.push(inputs.length);
    sent.push(...inputs);
    return inputs.length;
  }),
}));

import { notifyReviewAlert } from "@/lib/email/notify";
import { reportTarget } from "@/lib/moderation/reports";

let inst: string;

beforeEach(async () => {
  await resetDb();
  await runSeed();
  inst = (await getDefaultInstitution()).id;
  reportLimiter.reset();
  sent.length = 0;
  batches.length = 0;
});

let seq = 0;
const mkReporter = (institutionId?: string) =>
  mkUser(`denunciante${seq++}-${crypto.randomUUID().slice(0, 8)}@unifei.edu.br`, { institutionId });

async function setup() {
  const project = await mkProject({ name: "Equipe Quimera" });
  const opp = await mkOpportunity(project.id, { title: "Bolsista de Xilogravura" });
  await db.transaction((tx) => refreshProjectSearchDocuments(tx, project.id));
  await rebuildSearchVocabulary(inst);
  return { project, opp };
}

const reportRows = (targetId: string) => db.select().from(reports).where(eq(reports.targetId, targetId));
const opportunityStatus = async (id: string) =>
  (await db.select({ status: opportunities.status }).from(opportunities).where(eq(opportunities.id, id)))[0]!.status;
const hasWord = async (word: string) =>
  (
    await db
      .select()
      .from(searchVocabulary)
      .where(and(eq(searchVocabulary.institutionId, inst), eq(searchVocabulary.word, word)))
  ).length > 0;

describe("reportTarget", () => {
  it("grava a denúncia com o motivo e a descrição sem espaços nas pontas", async () => {
    const { opp } = await setup();
    const user = await mkReporter();
    const result = await reportTarget(user, {
      targetType: "OPPORTUNITY",
      targetId: opp.id,
      reasonCode: "FALSE_INFO",
      description: "  A bolsa não existe.  ",
    });
    expect(result).toEqual({ autoHidden: false, institutionId: inst, targetType: "OPPORTUNITY", targetId: opp.id });
    const rows = await reportRows(opp.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      institutionId: inst,
      targetType: "OPPORTUNITY",
      reporterUserId: user.id,
      reasonCode: "FALSE_INFO",
      reason: "A bolsa não existe.",
      resolvedAt: null,
    });
  });

  it("descrição vazia vira nula", async () => {
    const { project } = await setup();
    const user = await mkReporter();
    await reportTarget(user, { targetType: "PROJECT", targetId: project.id, reasonCode: "SPAM", description: "   " });
    expect((await reportRows(project.id))[0]!.reason).toBeNull();
  });

  it(`a ${REPORT_THRESHOLD}ª denúncia distinta oculta o processo, audita e tira as palavras do vocabulário`, async () => {
    const { opp } = await setup();
    for (let i = 0; i < REPORT_THRESHOLD - 1; i++) {
      const r = await reportTarget(await mkReporter(), {
        targetType: "OPPORTUNITY",
        targetId: opp.id,
        reasonCode: "SPAM",
      });
      expect(r.autoHidden).toBe(false);
    }
    expect(await opportunityStatus(opp.id)).toBe("OPEN");
    expect(await hasWord("xilogravura")).toBe(true);

    const last = await reportTarget(await mkReporter(), {
      targetType: "OPPORTUNITY",
      targetId: opp.id,
      reasonCode: "SPAM",
    });
    expect(last).toEqual({ autoHidden: true, institutionId: inst, targetType: "OPPORTUNITY", targetId: opp.id });
    expect(await opportunityStatus(opp.id)).toBe("UNDER_REVIEW");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "TARGET_AUTO_REVIEW"));
    expect(logs).toHaveLength(1);
    expect(await hasWord("xilogravura")).toBe(false);
  });

  it("projeto também vai para revisão na 5ª denúncia", async () => {
    const { project } = await setup();
    let last;
    for (let i = 0; i < REPORT_THRESHOLD; i++) {
      last = await reportTarget(await mkReporter(), {
        targetType: "PROJECT",
        targetId: project.id,
        reasonCode: "INAPPROPRIATE",
      });
    }
    expect(last!.autoHidden).toBe(true);
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row!.status).toBe("UNDER_REVIEW");
  });

  it("denúncia repetida responde igual e não grava outra linha nem conta duas vezes", async () => {
    const { opp } = await setup();
    const user = await mkReporter();
    const input = { targetType: "OPPORTUNITY", targetId: opp.id, reasonCode: "SPAM" } as const;
    const first = await reportTarget(user, input);
    for (let i = 0; i < REPORT_THRESHOLD; i++) expect(await reportTarget(user, input)).toEqual(first);
    expect(await reportRows(opp.id)).toHaveLength(1);
    expect(await opportunityStatus(opp.id)).toBe("OPEN");
  });

  it("membro do projeto recebe DomainError ao denunciar o projeto ou um processo dele", async () => {
    const { project, opp } = await setup();
    const member = await mkReporter();
    await addMember(project.id, member.id, "REVIEWER");
    await expect(
      reportTarget(member, { targetType: "PROJECT", targetId: project.id, reasonCode: "SPAM" }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      reportTarget(member, { targetType: "OPPORTUNITY", targetId: opp.id, reasonCode: "SPAM" }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(await reportRows(project.id)).toHaveLength(0);
    expect(await reportRows(opp.id)).toHaveLength(0);
  });

  it("id inexistente e alvo de outra instituição respondem como um alvo válido, sem gravar nada", async () => {
    const user = await mkReporter();
    const missing = "00000000-0000-4000-8000-000000000000";
    for (const targetType of ["PROJECT", "OPPORTUNITY"] as const) {
      expect(await reportTarget(user, { targetType, targetId: missing, reasonCode: "SPAM" })).toEqual({
        autoHidden: false,
        institutionId: inst,
        targetType,
        targetId: missing,
      });
    }
    const foreign = await mkForeignInstitution();
    const foreignProject = await mkProject({ institutionId: foreign.id });
    const foreignOpp = await mkOpportunity(foreignProject.id);
    expect(
      await reportTarget(user, { targetType: "PROJECT", targetId: foreignProject.id, reasonCode: "SPAM" }),
    ).toEqual({
      autoHidden: false,
      institutionId: inst,
      targetType: "PROJECT",
      targetId: foreignProject.id,
    });
    expect(
      await reportTarget(user, { targetType: "OPPORTUNITY", targetId: foreignOpp.id, reasonCode: "SPAM" }),
    ).toEqual({
      autoHidden: false,
      institutionId: inst,
      targetType: "OPPORTUNITY",
      targetId: foreignOpp.id,
    });
    expect(await db.select().from(reports)).toHaveLength(0);
  });

  it("alvo já oculto responde como um alvo válido, não grava nada e não muda de estado", async () => {
    const { opp } = await setup();
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    await hideTarget(admin, {
      targetType: "OPPORTUNITY",
      targetId: opp.id,
      reason: "Oculto pela moderação para teste.",
    });
    let last;
    for (let i = 0; i < REPORT_THRESHOLD; i++) {
      last = await reportTarget(await mkReporter(), {
        targetType: "OPPORTUNITY",
        targetId: opp.id,
        reasonCode: "SPAM",
      });
    }
    expect(last).toEqual({ autoHidden: false, institutionId: inst, targetType: "OPPORTUNITY", targetId: opp.id });
    expect(await reportRows(opp.id)).toHaveLength(0);
    expect(await opportunityStatus(opp.id)).toBe("UNDER_REVIEW");
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, "TARGET_AUTO_REVIEW"))).toHaveLength(0);
  });

  it("alvo fora do estado público não grava nada e responde igual", async () => {
    const user = await mkReporter();
    const cases: { targetType: "PROJECT" | "OPPORTUNITY"; targetId: string }[] = [];
    for (const status of ["SUSPENDED", "UNDER_REVIEW"] as const) {
      const project = await mkProject({ status });
      cases.push({ targetType: "PROJECT", targetId: project.id });
      // Processo visível por si, mas o projeto oculto o tira do ar.
      cases.push({ targetType: "OPPORTUNITY", targetId: (await mkOpportunity(project.id)).id });
    }
    const active = await mkProject();
    cases.push({
      targetType: "OPPORTUNITY",
      targetId: (await mkOpportunity(active.id, { status: "UNDER_REVIEW" })).id,
    });

    for (const target of cases) {
      expect(await reportTarget(user, { ...target, reasonCode: "SPAM" })).toEqual({
        autoHidden: false,
        institutionId: inst,
        ...target,
      });
    }
    expect(await db.select().from(reports)).toHaveLength(0);
  });

  it("projeto arquivado e processo encerrado seguem públicos e recebem denúncia", async () => {
    const user = await mkReporter();
    const archived = await mkProject({ status: "ARCHIVED" });
    const closed = await mkOpportunity(archived.id, { status: "CLOSED", closedAt: new Date() });
    await reportTarget(user, { targetType: "PROJECT", targetId: archived.id, reasonCode: "SPAM" });
    await reportTarget(user, { targetType: "OPPORTUNITY", targetId: closed.id, reasonCode: "SPAM" });
    expect(await reportRows(archived.id)).toHaveLength(1);
    expect(await reportRows(closed.id)).toHaveLength(1);
  });

  it("entrada inválida dá ValidationError e não gasta o limite", async () => {
    const { opp } = await setup();
    const user = await mkReporter();
    const bad = [
      { targetType: "OPPORTUNITY", targetId: "1", reasonCode: "SPAM" },
      { targetType: "USER", targetId: opp.id, reasonCode: "SPAM" },
      { targetType: "OPPORTUNITY", targetId: opp.id, reasonCode: "OUTRO" },
      { targetType: "OPPORTUNITY", targetId: opp.id, reasonCode: "SPAM", description: "x".repeat(501) },
    ];
    for (const input of bad) {
      await expect(reportTarget(user, input as Parameters<typeof reportTarget>[1])).rejects.toBeInstanceOf(
        ValidationError,
      );
    }
    for (let i = 0; i < 10; i++) {
      await reportTarget(user, { targetType: "OPPORTUNITY", targetId: opp.id, reasonCode: "SPAM" });
    }
  });

  it("a 11ª denúncia no dia dá RateLimitError", async () => {
    const user = await mkReporter();
    for (let i = 0; i < 10; i++) {
      const project = await mkProject();
      await reportTarget(user, { targetType: "PROJECT", targetId: project.id, reasonCode: "SPAM" });
    }
    const project = await mkProject();
    await expect(
      reportTarget(user, { targetType: "PROJECT", targetId: project.id, reasonCode: "SPAM" }),
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(await reportRows(project.id)).toHaveLength(0);
  });

  it("5 denúncias concorrentes de usuários distintos: autoHidden aparece exatamente uma vez", async () => {
    const { opp } = await setup();
    const users = await Promise.all(Array.from({ length: REPORT_THRESHOLD }, () => mkReporter()));
    const results = await Promise.all(
      users.map((u) => reportTarget(u, { targetType: "OPPORTUNITY", targetId: opp.id, reasonCode: "SPAM" })),
    );
    expect(results.filter((r) => r.autoHidden)).toHaveLength(1);
    expect(await reportRows(opp.id)).toHaveLength(REPORT_THRESHOLD);
    expect(await opportunityStatus(opp.id)).toBe("UNDER_REVIEW");
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, "TARGET_AUTO_REVIEW"))).toHaveLength(1);
  });
});

describe("notifyReviewAlert", () => {
  it("um e-mail a cada SYSTEM_ADMIN não banido da instituição, com tipo, nome e link para /admin", async () => {
    const { project, opp } = await setup();
    const a = await mkUser("sys1@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const b = await mkUser("sys2@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    await mkUser("banido@unifei.edu.br", { systemRole: "SYSTEM_ADMIN", isBanned: true });
    await mkUser("comum@unifei.edu.br");
    const foreign = await mkForeignInstitution();
    await mkUser("sys@outra.edu.br", { systemRole: "SYSTEM_ADMIN", institutionId: foreign.id });

    await notifyReviewAlert({ institutionId: inst, targetType: "OPPORTUNITY", targetId: opp.id });
    expect(batches).toEqual([2]);
    expect(sent.map((s) => s.to).sort()).toEqual([a.email, b.email].sort());
    const html = await render(sent[0]!.react);
    expect(sent[0]!.subject).toContain("Bolsista de Xilogravura");
    expect(html).toContain("Processo");
    expect(html).toContain("Bolsista de Xilogravura");
    expect(html).toMatch(/href="https?:\/\/[^"]+\/admin"/);

    sent.length = 0;
    await notifyReviewAlert({ institutionId: inst, targetType: "PROJECT", targetId: project.id });
    const projectHtml = await render(sent[0]!.react);
    expect(projectHtml).toContain("Projeto");
    expect(projectHtml).toContain("Equipe Quimera");
  });

  it("alvo inexistente ou de outra instituição não envia nem lança", async () => {
    await mkUser("sys1@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const foreign = await mkForeignInstitution();
    const foreignProject = await mkProject({ institutionId: foreign.id });
    await expect(
      notifyReviewAlert({
        institutionId: inst,
        targetType: "PROJECT",
        targetId: "00000000-0000-4000-8000-000000000000",
      }),
    ).resolves.toBeUndefined();
    await notifyReviewAlert({ institutionId: inst, targetType: "PROJECT", targetId: foreignProject.id });
    expect(sent).toHaveLength(0);
  });
});
