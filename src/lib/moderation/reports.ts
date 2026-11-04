import { and, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { opportunities, projectMembers, projects, reports, users } from "@/db/schema";
import type { AuthUser } from "@/lib/auth/guards";
import { DomainError, fromZodError, RateLimitError } from "@/lib/domain-errors";
import { publicOpportunitySql } from "@/lib/public/queries";
import { lockProjectSearchDocuments, scheduleVocabularyRebuild } from "@/lib/search/index-documents";
import { reportLimiter } from "@/lib/security/rate-limit";
import { type ModerationTargetType, type ReportInput, reportSchema } from "@/lib/validation/moderation";
import { applyAutomaticReview, type ModerationTarget } from "./service";

export const REPORT_RECEIVED = "Recebemos sua denúncia.";
export const REPORT_RATE_LIMITED = "Muitas denúncias hoje. Tente de novo amanhã.";
export const REPORT_OWN_PROJECT = "Você faz parte da equipe deste projeto e não pode denunciá-lo.";

export type ReportResult = {
  autoHidden: boolean;
  institutionId: string;
  targetType: ModerationTargetType;
  targetId: string;
};

/** Projeto do alvo, dentro da instituição; nulo se não existe ou é de outra. */
async function targetProjectId(
  tx: Tx | typeof db,
  target: ModerationTarget,
  institutionId: string,
): Promise<string | null> {
  if (target.targetType === "PROJECT") {
    const [row] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, target.targetId), eq(projects.institutionId, institutionId)));
    return row?.id ?? null;
  }
  const [row] = await tx
    .select({ projectId: opportunities.projectId })
    .from(opportunities)
    .where(and(eq(opportunities.id, target.targetId), eq(opportunities.institutionId, institutionId)));
  return row?.projectId ?? null;
}

/** O alvo está no ar: projeto ativo ou arquivado; processo pela mesma regra da vitrine. */
async function isPublic(tx: Tx, target: ModerationTarget): Promise<boolean> {
  if (target.targetType === "PROJECT") {
    const [row] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, target.targetId), inArray(projects.status, ["ACTIVE", "ARCHIVED"])));
    return Boolean(row);
  }
  const [row] = await tx
    .select({ id: opportunities.id })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(and(eq(opportunities.id, target.targetId), publicOpportunitySql()));
  return Boolean(row);
}

async function isMember(tx: Tx | typeof db, projectId: string, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  return Boolean(row);
}

/**
 * Denúncia da comunidade. Quem denuncia vê sempre a mesma resposta: alvo inexistente, de outra
 * instituição, fora do ar ou denúncia repetida não se distinguem de uma nova (spec §4). Alvo fora do
 * ar não grava nada. A trava do projeto vem antes de conferir, gravar e contar, para a ocultação
 * concorrente ser vista e só uma denúncia concorrente cruzar o limite.
 */
export async function reportTarget(user: AuthUser, input: ReportInput): Promise<ReportResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) throw fromZodError(parsed.error);
  const { targetType, targetId, reasonCode, description } = parsed.data;
  const target = { targetType, targetId };

  // Só depois de validar: erro de preenchimento não gasta o limite.
  if (!reportLimiter.consume(user.id)) throw new RateLimitError(REPORT_RATE_LIMITED);

  const autoHidden = await db.transaction(async (tx) => {
    const projectId = await targetProjectId(tx, target, user.institutionId);
    if (!projectId) return false;
    await lockProjectSearchDocuments(tx, projectId);
    if (!(await isPublic(tx, target))) return false;
    if (await isMember(tx, projectId, user.id)) throw new DomainError("PROJECT_MEMBER", REPORT_OWN_PROJECT);

    // Repetida enquanto pendente: o índice único parcial descarta, e a resposta é a mesma.
    await tx
      .insert(reports)
      .values({
        institutionId: user.institutionId,
        targetType,
        targetId,
        reporterUserId: user.id,
        reasonCode,
        reason: description,
      })
      .onConflictDoNothing();
    return applyAutomaticReview(tx, target);
  });
  if (autoHidden) await scheduleVocabularyRebuild(user.institutionId);
  return { autoHidden, institutionId: user.institutionId, targetType, targetId };
}

/**
 * Para a página pública mostrar o botão "Denunciar": conta ativa, da instituição do alvo, fora da
 * equipe do projeto. Só consulta; quem decide de fato é `reportTarget`.
 */
export async function canReport(userId: string, target: ModerationTarget): Promise<boolean> {
  const [user] = await db
    .select({ institutionId: users.institutionId, isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, userId));
  if (!user || user.isBanned) return false;
  const projectId = await targetProjectId(db, target, user.institutionId);
  return projectId !== null && !(await isMember(db, projectId, userId));
}
