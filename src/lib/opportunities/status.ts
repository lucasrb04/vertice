import { sql, type SQL } from "drizzle-orm";
import { opportunities, projects } from "@/db/schema";
import type { OpportunityStatus, ProjectStatus } from "@/db/schema";
import { todayInSaoPaulo } from "@/lib/time";

/** Regra única de "processo aberto": status OPEN, prazo não vencido e projeto ACTIVE. */
export function isOpportunityOpen(
  o: { status: OpportunityStatus; deadlineAt: Date },
  projectStatus: ProjectStatus,
  now: Date = new Date(),
): boolean {
  return o.status === "OPEN" && o.deadlineAt.getTime() > now.getTime() && projectStatus === "ACTIVE";
}

/**
 * Versão SQL de `isOpportunityOpen`. Exige que a query faça join com `projects`.
 * O Subprojeto 2 (timeline pública) reusa este predicado.
 */
export function openOpportunitySql(now: Date = new Date()): SQL {
  return sql`${opportunities.status} = 'OPEN' AND ${opportunities.deadlineAt} > ${now.toISOString()}::timestamptz AND ${projects.status} = 'ACTIVE'`;
}

/** Data de encerramento: `closedAt`, ou o prazo se já venceu, ou `null` se ainda em andamento. */
export function closedOnDate(
  o: { status: OpportunityStatus; deadlineAt: Date; closedAt: Date | null },
  now: Date = new Date(),
): Date | null {
  if (o.closedAt) return o.closedAt;
  if (o.deadlineAt.getTime() <= now.getTime()) return o.deadlineAt;
  return null;
}

/** Abertura das inscrições em dia posterior a hoje (Brasília). O processo segue aberto; só o selo muda. */
export function opensInFuture(applicationsOpenOn: string | null, now: Date = new Date()): boolean {
  return applicationsOpenOn !== null && applicationsOpenOn > todayInSaoPaulo(now);
}

/** `Abre em dd/mm`, a partir de um dia `YYYY-MM-DD`. */
export function opensOnLabel(day: string): string {
  const [, m, d] = day.split("-");
  return `Abre em ${d}/${m}`;
}
