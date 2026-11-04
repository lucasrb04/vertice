import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError } from "@/lib/auth/errors";
import { hideTarget } from "@/lib/moderation/service";
import { listReportQueue, searchModerationTargets } from "@/lib/moderation/queries";
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

describe("searchModerationTargets", () => {
  it("acha projeto e processo por nome sem acento, em qualquer estado, inclusive oculto", async () => {
    const admin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const project = await mkProject({ name: "Laboratório de Xilogravura" });
    const open = await mkOpportunity(project.id, { title: "Bolsista de Xilogravura" });
    const hidden = await mkOpportunity(project.id, { title: "Estágio em xilogravura digital" });
    await hideTarget(admin!, { targetType: "OPPORTUNITY", targetId: hidden.id, reason: "Conteúdo impróprio confirmado." });

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
