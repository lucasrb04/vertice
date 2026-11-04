import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, opportunities, projects, reports } from "@/db/schema";
import { authorizeSystemAdmin, type AuthUser } from "@/lib/auth/guards";
import { isHidden } from "./service";
import type { ModerationTargetType, ReportReason } from "@/lib/validation/moderation";

type Status = typeof projects.$inferSelect.status | typeof opportunities.$inferSelect.status;

export type TargetRow = {
  targetType: ModerationTargetType;
  targetId: string;
  name: string;
  projectName: string;
  status: Status;
  /** Oculto pela moderação: define quais ações a interface oferece. */
  hidden: boolean;
  pendingCount: number;
};

export type QueueItem = TargetRow & {
  reasons: { code: ReportReason; count: number }[];
  descriptions: string[];
};

export const SEARCH_LIMIT = 20;

type Key = `${ModerationTargetType}:${string}`;
const keyOf = (t: { targetType: ModerationTargetType; targetId: string }): Key => `${t.targetType}:${t.targetId}`;

const norm = (col: unknown) => sql`lower(unaccent(${col}))`;

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function loadRows(institutionId: string, filter: { projects?: SQL; opportunities?: SQL }): Promise<Omit<TargetRow, "pendingCount" | "hidden">[]> {
  const projectRows = await db
    .select({ targetId: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(and(eq(projects.institutionId, institutionId), filter.projects))
    .orderBy(asc(projects.name))
    .limit(SEARCH_LIMIT * 5);
  const opportunityRows = await db
    .select({ targetId: opportunities.id, name: opportunities.title, projectName: projects.name, status: opportunities.status })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(and(eq(opportunities.institutionId, institutionId), filter.opportunities))
    .orderBy(asc(opportunities.title))
    .limit(SEARCH_LIMIT * 5);
  return [
    ...projectRows.map((r) => ({ ...r, targetType: "PROJECT" as const, projectName: r.name })),
    ...opportunityRows.map((r) => ({ ...r, targetType: "OPPORTUNITY" as const })),
  ];
}

const pendingOf = (institutionId: string) =>
  db
    .select({ targetType: reports.targetType, targetId: reports.targetId, reasonCode: reports.reasonCode, reason: reports.reason })
    .from(reports)
    .where(and(eq(reports.institutionId, institutionId), isNull(reports.resolvedAt)));

/**
 * Alvos com denúncias pendentes, mais denunciados primeiro. Nunca devolve quem denunciou:
 * só motivos, contagens e as descrições, sem autoria.
 */
export async function listReportQueue(admin: AuthUser): Promise<QueueItem[]> {
  await authorizeSystemAdmin(admin, { path: "moderation:listReportQueue", ipAddress: null });
  const pending = await pendingOf(admin.institutionId);

  type Group = { targetType: ModerationTargetType; targetId: string; reasons: Map<ReportReason, number>; descriptions: string[] };
  const grouped = new Map<Key, Group>();
  for (const r of pending) {
    const key = keyOf(r);
    const g: Group = grouped.get(key) ?? { targetType: r.targetType, targetId: r.targetId, reasons: new Map(), descriptions: [] };
    g.reasons.set(r.reasonCode, (g.reasons.get(r.reasonCode) ?? 0) + 1);
    const text = r.reason?.trim();
    if (text) g.descriptions.push(text);
    grouped.set(key, g);
  }
  if (grouped.size === 0) return [];

  const ids = (type: ModerationTargetType) => [...grouped.values()].filter((g) => g.targetType === type).map((g) => g.targetId);
  const projectIds = ids("PROJECT");
  const opportunityIds = ids("OPPORTUNITY");
  const rows = await loadRows(admin.institutionId, {
    projects: projectIds.length ? inArray(projects.id, projectIds) : sql`false`,
    opportunities: opportunityIds.length ? inArray(opportunities.id, opportunityIds) : sql`false`,
  });

  const items: QueueItem[] = [];
  for (const row of rows) {
    const g = grouped.get(keyOf(row));
    if (!g) continue;
    const reasons = [...g.reasons].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
    items.push({
      ...row,
      hidden: isHidden(row.targetType, row.status),
      pendingCount: reasons.reduce((n, r) => n + r.count, 0),
      reasons,
      descriptions: g.descriptions,
    });
  }
  return items.sort((a, b) => b.pendingCount - a.pendingCount || a.name.localeCompare(b.name, "pt-BR"));
}

/** Projeto ou processo pelo nome, sem acento e em qualquer estado, inclusive oculto. */
export async function searchModerationTargets(admin: AuthUser, q: string): Promise<TargetRow[]> {
  await authorizeSystemAdmin(admin, { path: "moderation:searchModerationTargets", ipAddress: null });
  const term = q.trim();
  if (!term) return [];
  const pattern = `%${escapeLike(term)}%`;
  const rows = await loadRows(admin.institutionId, {
    projects: sql`${norm(projects.name)} LIKE ${sql`lower(unaccent(${pattern}::text))`}`,
    opportunities: sql`${norm(opportunities.title)} LIKE ${sql`lower(unaccent(${pattern}::text))`}`,
  });
  const found = rows
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.targetType.localeCompare(b.targetType))
    .slice(0, SEARCH_LIMIT);

  const counts = new Map<Key, number>();
  for (const r of await pendingOf(admin.institutionId)) counts.set(keyOf(r), (counts.get(keyOf(r)) ?? 0) + 1);
  return found.map((r) => ({ ...r, hidden: isHidden(r.targetType, r.status), pendingCount: counts.get(keyOf(r)) ?? 0 }));
}

/** Texto do aviso quando a ocultação veio da revisão automática, que não tem motivo escrito. */
export const AUTO_REVIEW_NOTICE = "Oculto após denúncias da comunidade.";

/**
 * Motivo da última ocultação do projeto, para os membros. Quem chama já provou a membership;
 * a consulta não devolve autor nem IP.
 */
export async function getProjectHiddenReason(project: { id: string; institutionId: string }): Promise<string | null> {
  const [last] = await db
    .select({ action: auditLogs.action, metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.institutionId, project.institutionId),
        eq(auditLogs.targetType, "PROJECT"),
        eq(auditLogs.targetId, project.id),
        inArray(auditLogs.action, ["PROJECT_SUSPENDED", "TARGET_AUTO_REVIEW"]),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  if (!last) return null;
  if (last.action === "TARGET_AUTO_REVIEW") return AUTO_REVIEW_NOTICE;
  const reason = last.metadata?.reason;
  return typeof reason === "string" ? reason : null;
}
