import { beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, opportunities, projects, reports, searchVocabulary } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError } from "@/lib/auth/errors";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import {
  REPORT_THRESHOLD,
  applyAutomaticReview,
  dismissReports,
  hideTarget,
  restoreTarget,
} from "@/lib/moderation/service";
import { getPublicOpportunity, getPublicProject, searchOpportunities } from "@/lib/public/queries";
import { parseVitrineParams } from "@/lib/public/search-params";
import { rebuildSearchVocabulary, refreshProjectSearchDocuments } from "@/lib/search/index-documents";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import { mkForeignInstitution, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";

let inst: string;

beforeEach(async () => {
  await resetDb();
  await runSeed();
  inst = (await getDefaultInstitution()).id;
});

const REASON = "Conteúdo falso denunciado pela comunidade.";

async function setup(opts: { projectStatus?: "ACTIVE" | "ARCHIVED"; opportunityStatus?: "OPEN" | "CLOSED" } = {}) {
  const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
  const user = await mkUser("aluno@unifei.edu.br");
  const project = await mkProject({ name: "Equipe Quimera", status: opts.projectStatus ?? "ACTIVE" });
  const opp = await mkOpportunity(project.id, { title: "Bolsista de Xilogravura", status: opts.opportunityStatus ?? "OPEN" });
  await db.transaction((tx) => refreshProjectSearchDocuments(tx, project.id));
  await rebuildSearchVocabulary(inst);
  return { admin, user, project, opp };
}

const projectRow = async (id: string) => (await db.select().from(projects).where(eq(projects.id, id)))[0];
const opportunityRow = async (id: string) => (await db.select().from(opportunities).where(eq(opportunities.id, id)))[0];
const searchTitles = async (q: string) =>
  (await searchOpportunities(inst, parseVitrineParams({ q, encerrados: "1" }))).items.map((i) => i.title);
const hasWord = async (word: string) =>
  (
    await db
      .select()
      .from(searchVocabulary)
      .where(and(eq(searchVocabulary.institutionId, inst), eq(searchVocabulary.word, word)))
  ).length > 0;

async function mkReports(targetType: "PROJECT" | "OPPORTUNITY", targetId: string, n: number, institutionId = inst) {
  for (let i = 0; i < n; i++) {
    const reporter = await mkUser(`denunciante${i}-${crypto.randomUUID().slice(0, 8)}@unifei.edu.br`, { institutionId });
    await db.insert(reports).values({ institutionId, targetType, targetId, reporterUserId: reporter.id, reasonCode: "SPAM", reason: null });
  }
}

const pendingReports = async (targetId: string) =>
  db.select().from(reports).where(and(eq(reports.targetId, targetId), isNull(reports.resolvedAt)));

describe("hideTarget", () => {
  it("projeto ACTIVE vira SUSPENDED, guarda o estado e some da vitrine, da busca e do vocabulário", async () => {
    const s = await setup();
    expect(await searchTitles("xilogravura")).toEqual(["Bolsista de Xilogravura"]);
    expect(await hasWord("xilogravura")).toBe(true);

    await hideTarget(s.admin, { targetType: "PROJECT", targetId: s.project.id, reason: REASON }, { ipAddress: "10.0.0.9" });

    const row = await projectRow(s.project.id);
    expect(row.status).toBe("SUSPENDED");
    expect(row.statusBeforeModeration).toBe("ACTIVE");
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "PROJECT_SUSPENDED"));
    expect(log).toMatchObject({
      institutionId: inst,
      actorUserId: s.admin.id,
      targetType: "PROJECT",
      targetId: s.project.id,
      ipAddress: "10.0.0.9",
      metadata: { reason: REASON, previousStatus: "ACTIVE", newStatus: "SUSPENDED" },
    });
    expect(await searchTitles("xilogravura")).toEqual([]);
    expect(await hasWord("xilogravura")).toBe(false);
    expect(await getPublicOpportunity(inst, s.opp.slug)).toBeNull();
    expect(await getPublicProject(inst, s.project.slug)).toBeNull();
  });

  it("processo OPEN vira UNDER_REVIEW", async () => {
    const s = await setup();
    await hideTarget(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: REASON });
    const row = await opportunityRow(s.opp.id);
    expect(row.status).toBe("UNDER_REVIEW");
    expect(row.statusBeforeModeration).toBe("OPEN");
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "OPPORTUNITY_HIDDEN"));
    expect(log.metadata).toEqual({ reason: REASON, previousStatus: "OPEN", newStatus: "UNDER_REVIEW" });
    expect(await searchTitles("xilogravura")).toEqual([]);
    expect(await hasWord("xilogravura")).toBe(false);
    expect(await getPublicOpportunity(inst, s.opp.slug)).toBeNull();
  });

  it("ocultar o que já está oculto pelo admin: DomainError", async () => {
    const s = await setup();
    await hideTarget(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: REASON });
    await expect(
      hideTarget(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: REASON }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("projeto em revisão automática vira SUSPENDED e mantém o estado original", async () => {
    const s = await setup({ projectStatus: "ARCHIVED" });
    await mkReports("PROJECT", s.project.id, REPORT_THRESHOLD);
    await db.transaction((tx) => applyAutomaticReview(tx, { targetType: "PROJECT", targetId: s.project.id }));
    await hideTarget(s.admin, { targetType: "PROJECT", targetId: s.project.id, reason: REASON });
    const row = await projectRow(s.project.id);
    expect(row.status).toBe("SUSPENDED");
    expect(row.statusBeforeModeration).toBe("ARCHIVED");
  });
});

describe("restoreTarget", () => {
  it("projeto ARCHIVED volta a ARCHIVED, zera a coluna, resolve denúncias e reindexa", async () => {
    const s = await setup({ projectStatus: "ARCHIVED" });
    await hideTarget(s.admin, { targetType: "PROJECT", targetId: s.project.id, reason: REASON });
    await mkReports("PROJECT", s.project.id, 2);
    await restoreTarget(s.admin, { targetType: "PROJECT", targetId: s.project.id, reason: "Revisado, conteúdo legítimo." });

    const row = await projectRow(s.project.id);
    expect(row.status).toBe("ARCHIVED");
    expect(row.statusBeforeModeration).toBeNull();
    expect(await pendingReports(s.project.id)).toHaveLength(0);
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "PROJECT_RESTORED"));
    expect(log).toMatchObject({
      actorUserId: s.admin.id,
      targetId: s.project.id,
      metadata: { reason: "Revisado, conteúdo legítimo.", previousStatus: "SUSPENDED", newStatus: "ARCHIVED" },
    });
    expect(await searchTitles("xilogravura")).toEqual(["Bolsista de Xilogravura"]);
    expect(await hasWord("xilogravura")).toBe(true);
  });

  it("processo CLOSED volta a CLOSED", async () => {
    const s = await setup({ opportunityStatus: "CLOSED" });
    await hideTarget(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: REASON });
    await restoreTarget(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: REASON });
    const row = await opportunityRow(s.opp.id);
    expect(row.status).toBe("CLOSED");
    expect(row.statusBeforeModeration).toBeNull();
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "OPPORTUNITY_RESTORED"));
    expect(log.metadata).toEqual({ reason: REASON, previousStatus: "UNDER_REVIEW", newStatus: "CLOSED", resolvedReports: 0 });
  });

  it("restaurar algo não oculto: DomainError", async () => {
    const s = await setup();
    await expect(
      restoreTarget(s.admin, { targetType: "PROJECT", targetId: s.project.id, reason: REASON }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      restoreTarget(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: REASON }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("processo restaurado com projeto oculto continua fora da vitrine", async () => {
    const s = await setup();
    await hideTarget(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: REASON });
    await hideTarget(s.admin, { targetType: "PROJECT", targetId: s.project.id, reason: REASON });
    await restoreTarget(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: REASON });
    expect((await opportunityRow(s.opp.id)).status).toBe("OPEN");
    expect(await searchTitles("xilogravura")).toEqual([]);
    expect(await hasWord("xilogravura")).toBe(false);
    expect(await getPublicOpportunity(inst, s.opp.slug)).toBeNull();
  });
});

describe("dismissReports", () => {
  it("resolve as denúncias pendentes sem mudar o estado e audita", async () => {
    const s = await setup();
    await mkReports("OPPORTUNITY", s.opp.id, 3);
    await dismissReports(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: "Denúncias sem fundamento." });
    expect(await pendingReports(s.opp.id)).toHaveLength(0);
    expect((await opportunityRow(s.opp.id)).status).toBe("OPEN");
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "REPORTS_DISMISSED"));
    expect(log).toMatchObject({
      actorUserId: s.admin.id,
      targetType: "OPPORTUNITY",
      targetId: s.opp.id,
      metadata: { reason: "Denúncias sem fundamento.", previousStatus: "OPEN", newStatus: "OPEN", resolvedReports: 3 },
    });
  });
});

describe("autorização e validação", () => {
  const actions = [hideTarget, restoreTarget, dismissReports];

  it("não admin: NotFoundError com ADMIN_ACCESS_DENIED", async () => {
    const s = await setup();
    for (const action of actions) {
      await expect(
        action(s.user, { targetType: "PROJECT", targetId: s.project.id, reason: REASON }),
      ).rejects.toBeInstanceOf(NotFoundError);
    }
    const denied = await db.select().from(auditLogs).where(eq(auditLogs.action, "ADMIN_ACCESS_DENIED"));
    expect(denied).toHaveLength(actions.length);
    expect(denied[0].actorUserId).toBe(s.user.id);
    expect((await projectRow(s.project.id)).status).toBe("ACTIVE");
  });

  it("motivo com 9 ou 501 caracteres: ValidationError", async () => {
    const s = await setup();
    for (const reason of ["a".repeat(9), "a".repeat(501)]) {
      await expect(
        hideTarget(s.admin, { targetType: "PROJECT", targetId: s.project.id, reason }),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    await expect(
      hideTarget(s.admin, { targetType: "PROJECT", targetId: "nao-e-uuid", reason: REASON }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await projectRow(s.project.id)).status).toBe("ACTIVE");
  });

  it("alvo de outra instituição ou inexistente: NotFoundError", async () => {
    const s = await setup();
    const foreignInst = await mkForeignInstitution();
    const foreignProject = await mkProject({ institutionId: foreignInst.id });
    const foreignOpp = await mkOpportunity(foreignProject.id);
    await expect(
      hideTarget(s.admin, { targetType: "PROJECT", targetId: foreignProject.id, reason: REASON }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      hideTarget(s.admin, { targetType: "OPPORTUNITY", targetId: foreignOpp.id, reason: REASON }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      hideTarget(s.admin, { targetType: "OPPORTUNITY", targetId: crypto.randomUUID(), reason: REASON }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await projectRow(foreignProject.id)).status).toBe("ACTIVE");
    expect((await opportunityRow(foreignOpp.id)).status).toBe("OPEN");
  });
});

describe("applyAutomaticReview", () => {
  const review = (targetType: "PROJECT" | "OPPORTUNITY", targetId: string) =>
    db.transaction((tx) => applyAutomaticReview(tx, { targetType, targetId }));

  it("limite é 5", () => {
    expect(REPORT_THRESHOLD).toBe(5);
  });

  it("4 denúncias pendentes não mudam nada; a 5ª oculta e audita sem ator", async () => {
    const s = await setup();
    await mkReports("OPPORTUNITY", s.opp.id, 4);
    expect(await review("OPPORTUNITY", s.opp.id)).toBe(false);
    expect((await opportunityRow(s.opp.id)).status).toBe("OPEN");

    await mkReports("OPPORTUNITY", s.opp.id, 1);
    expect(await review("OPPORTUNITY", s.opp.id)).toBe(true);
    const row = await opportunityRow(s.opp.id);
    expect(row.status).toBe("UNDER_REVIEW");
    expect(row.statusBeforeModeration).toBe("OPEN");
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "TARGET_AUTO_REVIEW"));
    expect(log).toMatchObject({
      institutionId: inst,
      actorUserId: null,
      targetType: "OPPORTUNITY",
      targetId: s.opp.id,
      metadata: { previousStatus: "OPEN", newStatus: "UNDER_REVIEW", pendingReports: 5 },
    });
    expect(await searchTitles("xilogravura")).toEqual([]);
  });

  it("projeto com 5 denúncias vai para UNDER_REVIEW", async () => {
    const s = await setup({ projectStatus: "ARCHIVED" });
    await mkReports("PROJECT", s.project.id, 5);
    expect(await review("PROJECT", s.project.id)).toBe(true);
    const row = await projectRow(s.project.id);
    expect(row.status).toBe("UNDER_REVIEW");
    expect(row.statusBeforeModeration).toBe("ARCHIVED");
  });

  it("alvo já oculto: false, sem nova auditoria", async () => {
    const s = await setup();
    await hideTarget(s.admin, { targetType: "PROJECT", targetId: s.project.id, reason: REASON });
    await mkReports("PROJECT", s.project.id, 6);
    expect(await review("PROJECT", s.project.id)).toBe(false);
    expect((await projectRow(s.project.id)).status).toBe("SUSPENDED");
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, "TARGET_AUTO_REVIEW"))).toHaveLength(0);
  });

  it("denúncias resolvidas não contam", async () => {
    const s = await setup();
    await mkReports("OPPORTUNITY", s.opp.id, 4);
    await dismissReports(s.admin, { targetType: "OPPORTUNITY", targetId: s.opp.id, reason: "Denúncias sem fundamento." });
    await mkReports("OPPORTUNITY", s.opp.id, 1);
    expect(await review("OPPORTUNITY", s.opp.id)).toBe(false);
    expect((await opportunityRow(s.opp.id)).status).toBe("OPEN");
  });

  it("alvo inexistente: false", async () => {
    expect(await review("OPPORTUNITY", crypto.randomUUID())).toBe(false);
  });
});
