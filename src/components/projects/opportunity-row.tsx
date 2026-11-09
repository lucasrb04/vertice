import Link from "next/link";
import { closeOpportunityAction } from "@/actions/opportunity.actions";
import { Button } from "@/components/ui/button";
import { deadlineLabel } from "@/lib/projects/labels";
import type { PanelOpportunity } from "@/lib/projects/queries";
import { opportunityStatsParts } from "@/lib/projects/stats";
import { daysUntil, formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ConfirmActionButton } from "./confirm-action-button";

function ChannelBadge({ children }: { children: string }) {
  return <span className="rounded-[8px] bg-fact px-2 py-0.5 text-[0.82rem] font-semibold text-ink">{children}</span>;
}

/**
 * Linha de processo no painel (spec §6.9). Ações só quando `canEdit` (OWNER/ADMIN em projeto ACTIVE);
 * "Candidatos" para quem tem membership real, inclusive em processo encerrado ou projeto arquivado.
 * Processo oculto pela moderação mostra o motivo e não oferece editar nem duplicar (D46).
 */
export function OpportunityRow({
  projectId,
  opportunity: o,
  isOpen,
  canEdit,
  isMember,
  now = new Date(),
}: {
  projectId: string;
  opportunity: PanelOpportunity;
  isOpen: boolean;
  canEdit: boolean;
  isMember: boolean;
  now?: Date;
}) {
  const closingSoon = isOpen && daysUntil(o.deadlineAt, now) <= 7;
  const base = `/projetos/${projectId}/processos`;
  const showApplicants = isMember && o.internalSelectionEnabled;
  const canChange = canEdit && !o.hidden;

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="min-w-0 space-y-1">
        <p className="text-[1.05rem] font-bold [overflow-wrap:anywhere] text-ink">{o.title}</p>
        {o.hidden ? (
          <div className="space-y-0.5 text-sm">
            <p className="font-semibold text-danger-ink">Oculto pela moderação</p>
            {o.hiddenReason && <p className="[overflow-wrap:anywhere] text-ink-2">{o.hiddenReason}</p>}
          </div>
        ) : (
          <p className={cn("text-sm", closingSoon ? "font-semibold text-urgent-ink" : "text-ink-2")}>
            {isOpen ? deadlineLabel(o.deadlineAt) : o.closedOn ? `Encerrado em ${formatDay(o.closedOn)}` : "Encerrado"}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-sm text-ink-2">
            {o.vacanciesCount} {o.vacanciesCount === 1 ? "vaga" : "vagas"}
          </span>
          {o.hasExternalUrl && <ChannelBadge>Edital</ChannelBadge>}
          {o.internalSelectionEnabled && <ChannelBadge>Plataforma</ChannelBadge>}
        </div>
        <p className="text-sm text-ink-3 tabular-nums">
          {opportunityStatsParts({
            views: o.views,
            externalClicks: o.hasExternalUrl ? o.externalClicks : null,
          }).join(" · ")}
        </p>
      </div>
      {(canChange || showApplicants) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showApplicants && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/${o.id}/candidatos`}>Candidatos ({o.applicationsCount})</Link>
            </Button>
          )}
          {canChange && isOpen && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/${o.id}/editar`}>Editar</Link>
            </Button>
          )}
          {canChange && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/novo?duplicar=${o.id}`}>Duplicar</Link>
            </Button>
          )}
          {/* A ação irreversível fica por último, longe de Editar e Duplicar. */}
          {canChange && isOpen && (
            <ConfirmActionButton
              label="Encerrar agora"
              title="Encerrar este processo?"
              description="As inscrições fecham agora e o processo não pode ser reaberto. Para um novo ciclo, duplique-o."
              confirmLabel="Encerrar processo"
              action={closeOpportunityAction.bind(null, projectId, o.id)}
            />
          )}
        </div>
      )}
    </li>
  );
}
