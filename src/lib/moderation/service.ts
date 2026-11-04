import { and, countDistinct, eq, isNull } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { opportunities, projects, reports } from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import { authorizeSystemAdmin, type AuthUser } from "@/lib/auth/guards";
import { DomainError, fromZodError } from "@/lib/domain-errors";
import {
  lockProjectSearchDocuments,
  refreshProjectSearchDocuments,
  refreshSearchDocument,
  scheduleVocabularyRebuild,
} from "@/lib/search/index-documents";
import { logAudit, type AuditAction } from "@/lib/security/audit";
import { moderationActionSchema, type ModerationTargetType } from "@/lib/validation/moderation";

/** Denúncias pendentes de usuários distintos que tiram o alvo do ar (D18). */
export const REPORT_THRESHOLD = 5;

type ProjectStatus = typeof projects.$inferSelect.status;
type OpportunityStatus = typeof opportunities.$inferSelect.status;
type Status = ProjectStatus | OpportunityStatus;

export type ModerationTarget = { targetType: ModerationTargetType; targetId: string };
type Opts = { ipAddress?: string | null };

type LockedTarget = {
  institutionId: string;
  projectId: string;
  status: Status;
  statusBeforeModeration: Status | null;
};

const HIDDEN: Record<ModerationTargetType, readonly Status[]> = {
  PROJECT: ["UNDER_REVIEW", "SUSPENDED"],
  OPPORTUNITY: ["UNDER_REVIEW"],
};

/** Oculto antes desta coluna existir (SQL manual, D43): projeto volta ativo, processo volta pausado. */
const RESTORE_FALLBACK: Record<ModerationTargetType, Status> = { PROJECT: "ACTIVE", OPPORTUNITY: "PAUSED" };

const ACTIONS = {
  hide: { PROJECT: "PROJECT_SUSPENDED", OPPORTUNITY: "OPPORTUNITY_HIDDEN" },
  restore: { PROJECT: "PROJECT_RESTORED", OPPORTUNITY: "OPPORTUNITY_RESTORED" },
} satisfies Record<string, Record<ModerationTargetType, AuditAction>>;

export const isHidden = (targetType: ModerationTargetType, status: Status) => HIDDEN[targetType].includes(status);

/**
 * Trava do projeto primeiro e linha do alvo depois, na ordem de `lockProjectSearchDocuments`.
 * `institutionId` nulo só na revisão automática, que parte de uma denúncia já gravada.
 */
async function lockTarget(tx: Tx, target: ModerationTarget, institutionId: string | null): Promise<LockedTarget | null> {
  if (target.targetType === "PROJECT") {
    await lockProjectSearchDocuments(tx, target.targetId);
    const [row] = await tx
      .select({
        institutionId: projects.institutionId,
        projectId: projects.id,
        status: projects.status,
        statusBeforeModeration: projects.statusBeforeModeration,
      })
      .from(projects)
      .where(and(eq(projects.id, target.targetId), institutionId ? eq(projects.institutionId, institutionId) : undefined))
      .for("update");
    return row ?? null;
  }
  // O projeto de um processo nunca muda: lê-lo sem trava não abre corrida.
  const [ref] = await tx
    .select({ projectId: opportunities.projectId })
    .from(opportunities)
    .where(and(eq(opportunities.id, target.targetId), institutionId ? eq(opportunities.institutionId, institutionId) : undefined));
  if (!ref) return null;
  await lockProjectSearchDocuments(tx, ref.projectId);
  const [row] = await tx
    .select({
      institutionId: opportunities.institutionId,
      projectId: opportunities.projectId,
      status: opportunities.status,
      statusBeforeModeration: opportunities.statusBeforeModeration,
    })
    .from(opportunities)
    .where(eq(opportunities.id, target.targetId))
    .for("update");
  return row ?? null;
}

async function setStatus(tx: Tx, target: ModerationTarget, status: Status, before: Status | null): Promise<void> {
  if (target.targetType === "PROJECT") {
    await tx
      .update(projects)
      .set({ status: status as ProjectStatus, statusBeforeModeration: before as ProjectStatus | null })
      .where(eq(projects.id, target.targetId));
    await refreshProjectSearchDocuments(tx, target.targetId);
  } else {
    await tx
      .update(opportunities)
      .set({ status: status as OpportunityStatus, statusBeforeModeration: before as OpportunityStatus | null })
      .where(eq(opportunities.id, target.targetId));
    await refreshSearchDocument(tx, target.targetId);
  }
}

const pendingReportsOf = (target: ModerationTarget, institutionId: string) =>
  and(
    eq(reports.institutionId, institutionId),
    eq(reports.targetType, target.targetType),
    eq(reports.targetId, target.targetId),
    isNull(reports.resolvedAt),
  );

async function resolvePendingReports(tx: Tx, target: ModerationTarget, institutionId: string): Promise<number> {
  const rows = await tx
    .update(reports)
    .set({ resolvedAt: new Date() })
    .where(pendingReportsOf(target, institutionId))
    .returning({ id: reports.id });
  return rows.length;
}

type AdminStep = (tx: Tx, target: ModerationTarget, row: LockedTarget) => Promise<{
  action: AuditAction;
  newStatus: Status;
  metadata?: Record<string, unknown>;
}>;

/** Guard, Zod, trava, passo, auditoria e reindexação numa transação; vocabulário depois do commit. */
async function runAdminAction(name: string, admin: AuthUser, input: unknown, opts: Opts, step: AdminStep): Promise<void> {
  const ipAddress = opts.ipAddress ?? null;
  await authorizeSystemAdmin(admin, { path: `moderation:${name}`, ipAddress });
  const parsed = moderationActionSchema.safeParse(input);
  if (!parsed.success) throw fromZodError(parsed.error);
  const { reason, ...target } = parsed.data;

  const changed = await db.transaction(async (tx) => {
    const row = await lockTarget(tx, target, admin.institutionId);
    if (!row) throw new NotFoundError();
    const result = await step(tx, target, row);
    await logAudit(
      {
        institutionId: row.institutionId,
        actorUserId: admin.id,
        action: result.action,
        targetType: target.targetType,
        targetId: target.targetId,
        metadata: { reason, previousStatus: row.status, newStatus: result.newStatus, ...result.metadata },
        ipAddress,
      },
      tx,
    );
    return result.newStatus !== row.status;
  });
  if (changed) await scheduleVocabularyRebuild(admin.institutionId);
}

/** Projeto vira `SUSPENDED`; processo vira `UNDER_REVIEW`, pois o enum dele não tem `SUSPENDED` (spec §5). */
export async function hideTarget(admin: AuthUser, input: ModerationTarget & { reason: string }, opts: Opts = {}): Promise<void> {
  await runAdminAction("hideTarget", admin, input, opts, async (tx, target, row) => {
    const newStatus: Status = target.targetType === "PROJECT" ? "SUSPENDED" : "UNDER_REVIEW";
    if (row.status === newStatus) throw new DomainError("ALREADY_HIDDEN", "Este item já está oculto pela moderação.");
    // Projeto em revisão automática: o estado a restaurar é o de antes da revisão.
    const before = isHidden(target.targetType, row.status) ? row.statusBeforeModeration : row.status;
    await setStatus(tx, target, newStatus, before);
    return { action: ACTIONS.hide[target.targetType], newStatus };
  });
}

/** Volta ao estado guardado e resolve as denúncias pendentes: novas começam do zero (spec §7). */
export async function restoreTarget(admin: AuthUser, input: ModerationTarget & { reason: string }, opts: Opts = {}): Promise<void> {
  await runAdminAction("restoreTarget", admin, input, opts, async (tx, target, row) => {
    if (!isHidden(target.targetType, row.status)) {
      throw new DomainError("NOT_HIDDEN", "Este item não está oculto pela moderação.");
    }
    const newStatus = row.statusBeforeModeration ?? RESTORE_FALLBACK[target.targetType];
    await setStatus(tx, target, newStatus, null);
    const resolvedReports = await resolvePendingReports(tx, target, row.institutionId);
    return { action: ACTIONS.restore[target.targetType], newStatus, metadata: { resolvedReports } };
  });
}

/** Resolve as denúncias pendentes sem mudar o estado do alvo. */
export async function dismissReports(admin: AuthUser, input: ModerationTarget & { reason: string }, opts: Opts = {}): Promise<void> {
  await runAdminAction("dismissReports", admin, input, opts, async (tx, target, row) => {
    const resolvedReports = await resolvePendingReports(tx, target, row.institutionId);
    if (resolvedReports === 0) throw new DomainError("NO_PENDING_REPORTS", "Não há denúncias pendentes para este item.");
    return { action: "REPORTS_DISMISSED", newStatus: row.status, metadata: { resolvedReports } };
  });
}

/**
 * Roda na transação que gravou a denúncia. Com `REPORT_THRESHOLD` denunciantes distintos pendentes,
 * o alvo visível vai para `UNDER_REVIEW`. Devolve `true` só se ocultou agora; quem chama agenda
 * `scheduleVocabularyRebuild` e avisa os admins depois do commit.
 */
export async function applyAutomaticReview(tx: Tx, target: ModerationTarget): Promise<boolean> {
  const row = await lockTarget(tx, target, null);
  if (!row || isHidden(target.targetType, row.status)) return false;

  const [{ pending }] = await tx
    .select({ pending: countDistinct(reports.reporterUserId) })
    .from(reports)
    .where(pendingReportsOf(target, row.institutionId));
  if (pending < REPORT_THRESHOLD) return false;

  await setStatus(tx, target, "UNDER_REVIEW", row.status);
  await logAudit(
    {
      institutionId: row.institutionId,
      actorUserId: null,
      action: "TARGET_AUTO_REVIEW",
      targetType: target.targetType,
      targetId: target.targetId,
      metadata: { previousStatus: row.status, newStatus: "UNDER_REVIEW", pendingReports: pending },
    },
    tx,
  );
  return true;
}
