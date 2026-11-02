import Link from "next/link";
import { closeOpportunityAction } from "@/actions/opportunity.actions";
import { Button } from "@/components/ui/button";
import { deadlineLabel } from "@/lib/projects/labels";
import type { PanelOpportunity } from "@/lib/projects/queries";
import { daysUntil, formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ConfirmActionButton } from "./confirm-action-button";

function ChannelBadge({ children }: { children: string }) {
  return (
    <span className="rounded-md border border-stone-200 bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700">
      {children}
    </span>
  );
}

/** Linha de processo no painel (spec §6.9). Ações só quando `canEdit` (OWNER/ADMIN em projeto ACTIVE). */
export function OpportunityRow({
  projectId,
  opportunity: o,
  isOpen,
  canEdit,
  now = new Date(),
}: {
  projectId: string;
  opportunity: PanelOpportunity;
  isOpen: boolean;
  canEdit: boolean;
  now?: Date;
}) {
  const closingSoon = isOpen && daysUntil(o.deadlineAt, now) <= 7;
  const base = `/projetos/${projectId}/processos`;

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-stone-900">{o.title}</p>
        <p className={cn("font-mono text-xs", closingSoon ? "text-amber-700" : "text-stone-600")}>
          {isOpen ? deadlineLabel(o.deadlineAt) : o.closedOn ? `Encerrado em ${formatDay(o.closedOn)}` : "Encerrado"}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="font-mono text-xs text-stone-600">
            {o.vacanciesCount} {o.vacanciesCount === 1 ? "vaga" : "vagas"}
          </span>
          {o.hasExternalUrl && <ChannelBadge>Edital</ChannelBadge>}
          {o.internalSelectionEnabled && <ChannelBadge>Plataforma</ChannelBadge>}
        </div>
      </div>
      {canEdit && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isOpen && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`${base}/${o.id}/editar`}>Editar</Link>
              </Button>
              <ConfirmActionButton
                label="Encerrar agora"
                title="Encerrar este processo?"
                description="As inscrições fecham agora e o processo não pode ser reaberto. Para um novo ciclo, duplique-o."
                confirmLabel="Encerrar processo"
                action={closeOpportunityAction.bind(null, projectId, o.id)}
              />
            </>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/novo?duplicar=${o.id}`}>Duplicar</Link>
          </Button>
        </div>
      )}
    </li>
  );
}
