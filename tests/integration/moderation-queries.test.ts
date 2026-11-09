import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError } from "@/lib/auth/errors";
import {
  AUTO_REVIEW_NOTICE,
  getHiddenReasons,
  getModerationContent,
  listReportQueue,
  searchModerationTargets,
} from "@/lib/moderation/queries";
import { reportTarget } from "@/lib/moderation/reports";
import { hideTarget, restoreTarget } from "@/lib/moderation/service";
import { reportLimiter } from "@/lib/security/rate-limit";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import { mkForeignInstitution, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";

let inst: string;

beforeEach(async () => {
  await resetDb();
  await runSeed();
  inst = (await getDefaultInstitution()).id;
});

let seq = 0;
async function report(
  target: { targetType: "PROJECT" | "OPPORTUNITY"; targetId: string },
  reasonCode: "SPAM" | "FALSE_INFO" | "INAPPROPRIATE" | "OTHER" = "SPAM",
  extra: { reason?: string; resolvedAt?: Date; institutionId?: string } = {},
) {
  const reporter = await mkUser(`denunciante${seq++}@unifei.edu.br`, { institutionId: extra.institutionId });
  await db.insert(reports).values({
    institutionId: extra.institutionId ?? inst,
    ...target,
    reporterUserId: reporter!.id,
    reasonCode,
    reason: extra.reason ?? null,
    resolvedAt: extra.resolvedAt ?? null,
  });
  return reporter!;
}

describe("listReportQueue", () => {
  it("traz só alvos com denúncias pendentes, do mais ao menos denunciado, sem quem denunciou", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const project = await mkProject({ name: "Equipe Quimera" });
    const a = await mkOpportunity(project.id, { title: "Vaga A" });
    const b = await mkOpportunity(project.id, { title: "Vaga B" });
    const c = await mkOpportunity(project.id, { title: "Vaga C" });
    const reporters = [
      await report({ targetType: "OPPORTUNITY", targetId: a.id }, "SPAM", { reason: "Parece propaganda." }),
      await report({ targetType: "OPPORTUNITY", targetId: a.id }, "OTHER"),
      await report({ targetType: "OPPORTUNITY", targetId: b.id }, "SPAM"),
      await report({ targetType: "OPPORTUNITY", targetId: b.id }, "FALSE_INFO", { reason: "Bolsa inexistente." }),
      await report({ targetType: "OPPORTUNITY", targetId: b.id }, "SPAM"),
      await report({ targetType: "PROJECT", targetId: project.id }, "OTHER"),
      await report({ targetType: "OPPORTUNITY", targetId: c.id }, "SPAM", { resolvedAt: new Date() }),
    ];

    const queue = await listReportQueue(admin!);
    expect(queue.map((i) => i.targetId)).toEqual([b.id, a.id, project.id]);
    expect(queue[0]).toMatchObject({
      targetType: "OPPORTUNITY",
      name: "Vaga B",
      projectName: "Equipe Quimera",
      status: "OPEN",
      pendingCount: 3,
      descriptions: ["Bolsa inexistente."],
    });
    expect(queue[0]!.reasons).toEqual([
      { code: "SPAM", count: 2 },
      { code: "FALSE_INFO", count: 1 },
    ]);
    expect(queue[2]).toMatchObject({ targetType: "PROJECT", name: "Equipe Quimera", projectName: "Equipe Quimera" });

    const dump = JSON.stringify(queue);
    for (const r of reporters) {
      expect(dump).not.toContain(r.id);
      expect(dump).not.toContain(r.email);
    }
  });

  it("não traz denúncias de outra instituição", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const other = await mkForeignInstitution();
    const project = await mkProject({ institutionId: other.id });
    await report({ targetType: "PROJECT", targetId: project.id }, "SPAM", { institutionId: other.id });
    expect(await listReportQueue(admin!)).toEqual([]);
  });

  it("recusa quem não é admin", async () => {
    const user = await mkUser("aluno@unifei.edu.br");
    await expect(listReportQueue(user!)).rejects.toBeInstanceOf(NotFoundError);
    await expect(searchModerationTargets(user!, "x")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listReportQueue sem teto", () => {
  it("traz todos os alvos denunciados, mesmo acima do limite da busca", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const reporter = await mkUser("um.denunciante@unifei.edu.br");
    const project = await mkProject({ name: "Projeto com muitos processos" });
    const total = 105;
    const ids: string[] = [];
    for (let i = 0; i < total; i++)
      ids.push((await mkOpportunity(project.id, { title: `Processo ${String(i).padStart(3, "0")}` })).id);
    await db.insert(reports).values(
      ids.map((targetId) => ({
        institutionId: inst,
        targetType: "OPPORTUNITY" as const,
        targetId,
        reporterUserId: reporter!.id,
        reasonCode: "SPAM" as const,
      })),
    );
    const queue = await listReportQueue(admin!);
    expect(queue).toHaveLength(total);
  });
});

describe("getHiddenReasons", () => {
  beforeEach(() => reportLimiter.reset());

  it("hideTarget real: o projeto mostra o motivo gravado pelo admin", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const project = await mkProject();
    await hideTarget(admin!, {
      targetType: "PROJECT",
      targetId: project.id,
      reason: "Conteúdo fora das regras da plataforma.",
    });

    const reasons = await getHiddenReasons(inst, [{ targetType: "PROJECT", targetId: project.id }]);
    expect(reasons.get(`PROJECT:${project.id}`)).toBe("Conteúdo fora das regras da plataforma.");
  });

  it("vale a última ocultação; processo pelo admin e pela revisão automática, numa chamada", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const project = await mkProject();
    const byAdmin = await mkOpportunity(project.id, { title: "Oculto pelo admin" });
    const byReports = await mkOpportunity(project.id, { title: "Oculto por denúncias" });
    const visible = await mkOpportunity(project.id, { title: "Visível" });

    await hideTarget(admin!, { targetType: "OPPORTUNITY", targetId: byAdmin.id, reason: "Primeiro motivo do admin." });
    await restoreTarget(admin!, {
      targetType: "OPPORTUNITY",
      targetId: byAdmin.id,
      reason: "Restaurado para revisão.",
    });
    await hideTarget(admin!, { targetType: "OPPORTUNITY", targetId: byAdmin.id, reason: "Segundo motivo do admin." });
    for (let i = 0; i < 5; i++) {
      const u = await mkUser(`rep${seq++}@unifei.edu.br`);
      await reportTarget(u!, { targetType: "OPPORTUNITY", targetId: byReports.id, reasonCode: "SPAM" });
    }

    const reasons = await getHiddenReasons(inst, [
      { targetType: "OPPORTUNITY", targetId: byAdmin.id },
      { targetType: "OPPORTUNITY", targetId: byReports.id },
      { targetType: "OPPORTUNITY", targetId: visible.id },
    ]);
    expect(reasons.get(`OPPORTUNITY:${byAdmin.id}`)).toBe("Segundo motivo do admin.");
    expect(reasons.get(`OPPORTUNITY:${byReports.id}`)).toBe(AUTO_REVIEW_NOTICE);
    expect(reasons.has(`OPPORTUNITY:${visible.id}`)).toBe(false);
    expect((await getHiddenReasons(inst, [])).size).toBe(0);
  });

  it("não lê registros de outra instituição", async () => {
    const foreign = await mkForeignInstitution();
    const admin = await mkUser("sys@outra.edu.br", { systemRole: "SYSTEM_ADMIN", institutionId: foreign.id });
    const project = await mkProject({ institutionId: foreign.id });
    await hideTarget(admin!, { targetType: "PROJECT", targetId: project.id, reason: "Motivo de outra instituição." });
    expect((await getHiddenReasons(inst, [{ targetType: "PROJECT", targetId: project.id }])).size).toBe(0);
  });
});

describe("searchModerationTargets", () => {
  it("acha projeto e processo por nome sem acento, em qualquer estado, inclusive oculto", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const project = await mkProject({ name: "Laboratório de Xilogravura" });
    const open = await mkOpportunity(project.id, { title: "Bolsista de Xilogravura" });
    const hidden = await mkOpportunity(project.id, { title: "Estágio em xilogravura digital" });
    await hideTarget(admin!, {
      targetType: "OPPORTUNITY",
      targetId: hidden.id,
      reason: "Conteúdo impróprio confirmado.",
    });

    const rows = await searchModerationTargets(admin!, "LABORATÓRIO");
    expect(rows.map((r) => r.targetId)).toEqual([project.id]);

    const found = await searchModerationTargets(admin!, "xilogravura");
    expect(found.map((r) => r.targetId).sort()).toEqual([project.id, open.id, hidden.id].sort());
    expect(found.find((r) => r.targetId === hidden.id)).toMatchObject({
      targetType: "OPPORTUNITY",
      name: "Estágio em xilogravura digital",
      projectName: "Laboratório de Xilogravura",
      status: "UNDER_REVIEW",
      pendingCount: 0,
    });
  });

  it("trata % e _ como texto, ignora busca vazia e limita a 20", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    for (let i = 0; i < 22; i++) await mkProject({ name: `Núcleo ${i}` });
    await mkProject({ name: "Meta 100% pronta" });
    expect(await searchModerationTargets(admin!, "%")).toHaveLength(1);
    expect(await searchModerationTargets(admin!, "_")).toHaveLength(0);
    expect(await searchModerationTargets(admin!, "  ")).toEqual([]);
    expect(await searchModerationTargets(admin!, "nucleo")).toHaveLength(20);
  });
});

describe("getModerationContent", () => {
  it("mostra ao admin o conteúdo de um processo oculto, com o motivo", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const project = await mkProject({ name: "Projeto denunciado" });
    const opp = await mkOpportunity(project.id, {
      title: "Processo denunciado",
      description: "Texto **suspeito**.",
      externalUrl: "https://exemplo.com/edital",
      customQuestion: "Por quê?",
    });
    await hideTarget(admin!, { targetType: "OPPORTUNITY", targetId: opp.id, reason: "Link enganoso no edital." });

    const content = await getModerationContent(admin!, "OPPORTUNITY", opp.id);
    expect(content).toMatchObject({
      targetType: "OPPORTUNITY",
      name: "Processo denunciado",
      projectName: "Projeto denunciado",
      hidden: true,
      hiddenReason: "Link enganoso no edital.",
      description: "Texto **suspeito**.",
      publicPath: null,
    });
    expect(content!.fields).toEqual(
      expect.arrayContaining([
        { label: "Edital", value: "https://exemplo.com/edital" },
        { label: "Pergunta da candidatura", value: "Por quê?" },
      ]),
    );
  });

  it("projeto visível traz o caminho público e os campos de contato", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const project = await mkProject({ name: "Projeto visível" });
    const content = await getModerationContent(admin!, "PROJECT", project.id);
    expect(content).toMatchObject({ hidden: false, hiddenReason: null, publicPath: `/projeto/${project.slug}` });
    expect(content!.fields.map((f) => f.label)).toContain("E-mail de contato");
  });

  it("outra instituição, id inválido ou inexistente: null; quem não é admin: NotFoundError", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const other = await mkForeignInstitution();
    const foreign = await mkProject({ institutionId: other.id });
    expect(await getModerationContent(admin!, "PROJECT", foreign.id)).toBeNull();
    expect(await getModerationContent(admin!, "PROJECT", "nao-uuid")).toBeNull();
    expect(await getModerationContent(admin!, "OPPORTUNITY", crypto.randomUUID())).toBeNull();
    const user = await mkUser("aluno@unifei.edu.br");
    await expect(getModerationContent(user!, "PROJECT", foreign.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
