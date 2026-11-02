import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_LABELS,
  closedChip,
  deadlineChip,
  requirementsSummary,
  scholarshipSummary,
} from "@/lib/public/labels";
import type { PublicCard } from "@/lib/public/queries";
import { cn } from "@/lib/utils";

/**
 * Preenche o contêiner: a largura vem do carrossel ou da célula do grid.
 * `relative` prende o `sr-only`: absoluto solto escaparia do carrossel e alargaria a página.
 */
export function OpportunityCard({ card }: { card: PublicCard }) {
  const deadline = card.isOpen ? deadlineChip(card.deadlineAt) : closedChip(card.closedOn);
  const details = [scholarshipSummary(card), card.weeklyHours ? `${card.weeklyHours}h/sem` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/processo/${card.slug}`}
      className="group relative flex h-full w-full min-w-0 flex-col rounded-lg border border-stone-200 bg-white p-4 transition-[border-color,box-shadow] outline-none hover:border-stone-400 hover:shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <p className="flex min-w-0 items-center gap-1 text-sm font-medium text-stone-800">
        <span className="truncate">{card.projectAcronym ?? card.projectName}</span>
        {card.verified && (
          <>
            <BadgeCheck aria-hidden className="size-3.5 shrink-0 text-brand" />
            <span className="sr-only">Verificado</span>
          </>
        )}
      </p>
      <p className="truncate text-xs text-stone-500">{CATEGORY_LABELS[card.category]}</p>

      <h3 className="mt-3 line-clamp-2 min-h-[2lh] text-[0.9375rem] leading-snug font-semibold text-stone-900 group-hover:text-brand">
        {card.title}
      </h3>

      <p className="mt-2 truncate font-mono text-xs text-stone-600">{details}</p>

      {card.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <li key={tag} className="max-w-full min-w-0">
              <Badge
                variant="secondary"
                className="block h-auto max-w-full truncate rounded-md font-mono font-normal text-stone-700"
              >
                {tag}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-4">
        <div className="space-y-0.5 border-t border-stone-100 pt-3 text-xs">
          <p className="text-stone-600">{requirementsSummary(card)}</p>
          <p className={cn("font-mono", deadline.urgent ? "font-medium text-amber-600" : "text-stone-600")}>
            {deadline.text}
          </p>
        </div>
      </div>
    </Link>
  );
}
