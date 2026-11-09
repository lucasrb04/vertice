import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Clock,
  ExternalLink,
  GraduationCap,
  HandHeart,
  MousePointerClick,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { opensInFuture } from "@/lib/opportunities/status";
import {
  applicationRouteLabel,
  CATEGORY_LABELS,
  cardScholarshipLabel,
  closedChip,
  coursesLabel,
  deadlineChip,
  deadlineDate,
  publishedLabel,
  semesterRange,
} from "@/lib/public/labels";
import type { PublicCard } from "@/lib/public/queries";
import { deadlineFromDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Highlighted } from "./highlighted";
import { ProjectTile } from "./project-tile";

const fact = "inline-flex max-w-full items-center gap-1.5 rounded-[9px] bg-fact px-2.5 py-1 text-[0.94rem] font-medium";
const factIcon = "size-4 shrink-0 text-ink-2";
const footChip = "inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-[0.95rem] font-semibold";

function When({ card }: { card: PublicCard }) {
  if (!card.isOpen) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.95rem] text-ink-2">
        <CalendarX aria-hidden className="size-[18px]" />
        {closedChip(card.closedOn).text}
      </span>
    );
  }
  if (card.applicationsOpenOn && opensInFuture(card.applicationsOpenOn)) {
    return (
      <span className={cn(footChip, "bg-rosa-soft text-rosa-ink")}>
        <CalendarPlus aria-hidden className="size-[18px]" />
        Inscrições abrem em {deadlineDate(deadlineFromDay(card.applicationsOpenOn))} · até{" "}
        {deadlineDate(card.deadlineAt)}
      </span>
    );
  }
  const chip = deadlineChip(card.deadlineAt);
  const Icon = chip.urgent ? CalendarClock : Calendar;
  return (
    <span
      className={cn(
        chip.urgent
          ? cn(footChip, "bg-urgent-soft text-urgent-ink")
          : "inline-flex items-center gap-1.5 text-[0.95rem] text-ink-2",
      )}
    >
      <Icon aria-hidden className="size-[18px]" />
      {chip.text} · {deadlineDate(card.deadlineAt)}
    </span>
  );
}

/**
 * Card largo da lista: o título é o único link e cobre o card inteiro; "Ver processo" é só visual.
 * `relative` prende o link esticado e o `sr-only`.
 */
export function OpportunityCard({
  card,
  q,
  selectedTags = [],
}: {
  card: PublicCard;
  /** Busca atual: os termos aparecem realçados. */
  q?: string;
  /** Nomes das habilidades marcadas no filtro: aparecem destacadas. */
  selectedTags?: string[];
}) {
  const paid = card.scholarshipType !== "VOLUNTARY";
  const selected = new Set(selectedTags.map((t) => t.toLocaleLowerCase("pt-BR")));

  return (
    <article className="group relative grid grid-cols-[48px_minmax(0,1fr)] gap-x-3.5 gap-y-1 rounded-2xl border border-transparent bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-150 ease-out hover:border-line-strong hover:shadow-card-hover motion-safe:animate-card-in sm:grid-cols-[60px_minmax(0,1fr)] sm:gap-x-[18px] sm:px-6 sm:py-[22px]">
      <ProjectTile
        category={card.category}
        name={card.projectName}
        acronym={card.projectAcronym}
        className="row-span-2"
      />
      <div className="min-w-0">
        <h3 className="font-heading text-[1.14rem] leading-tight font-bold [overflow-wrap:anywhere] text-ink sm:text-[1.32rem]">
          <Link
            href={`/processo/${card.slug}`}
            className="decoration-2 underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
          >
            <Highlighted text={card.title} q={q} />
          </Link>
        </h3>
        <p className="mt-1 text-[0.94rem] font-medium [overflow-wrap:anywhere] text-ink sm:text-base">
          <Highlighted text={card.projectName} q={q} />
          {card.verified && (
            <>
              <BadgeCheck aria-hidden className="ml-1 inline size-[17px] align-[-3px] text-[#2350b5]" />
              <span className="sr-only"> (verificado)</span>
            </>
          )}{" "}
          <span className="font-normal whitespace-nowrap text-ink-2 max-sm:block">
            <span className="max-sm:hidden">· </span>
            {CATEGORY_LABELS[card.category]}
          </span>
        </p>
      </div>

      <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
        {card.excerpt && (
          <p className="mt-2.5 max-w-[72ch] text-[0.98rem] [overflow-wrap:anywhere] text-ink-2 sm:mt-3 sm:text-[1.02rem]">
            <Highlighted text={card.excerpt} q={q} />
          </p>
        )}

        <ul className="mt-3.5 flex flex-wrap gap-2" aria-label="Resumo">
          <li className={cn(fact, paid && "bg-money-soft text-money-ink")}>
            {paid ? (
              <Wallet aria-hidden className={cn(factIcon, "text-money-ink")} />
            ) : (
              <HandHeart aria-hidden className={factIcon} />
            )}
            <span className="min-w-0 [overflow-wrap:anywhere]">{cardScholarshipLabel(card)}</span>
          </li>
          {card.weeklyHours ? (
            <li className={fact}>
              <Clock aria-hidden className={factIcon} />
              {card.weeklyHours} h por semana
            </li>
          ) : null}
          <li className={fact}>
            <GraduationCap aria-hidden className={factIcon} />
            {semesterRange(card.minSemester, card.maxSemester) ?? "Qualquer período"}
          </li>
          <li className={fact}>
            <BookOpen aria-hidden className={factIcon} />
            {coursesLabel(card.courseCount)}
          </li>
        </ul>

        {card.tags.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Habilidades e temas">
            {card.tags.map((tag) => (
              <li
                key={tag}
                className={cn(
                  "max-w-full truncate rounded-full border px-2.5 py-0.5 text-[0.86rem]",
                  selected.has(tag.toLocaleLowerCase("pt-BR"))
                    ? "border-ink font-semibold text-ink"
                    : "border-line text-ink-2",
                )}
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-[#f0ebe2] pt-3.5">
          <When card={card} />
          <span className="inline-flex items-center gap-1.5 text-[0.93rem] text-ink-3">
            {card.internalSelectionEnabled ? (
              <MousePointerClick aria-hidden className="size-[17px]" />
            ) : (
              <ExternalLink aria-hidden className="size-[17px]" />
            )}
            {applicationRouteLabel(card)}
          </span>
          <span className="text-[0.93rem] text-ink-3">{publishedLabel(card.publishedAt)}</span>
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[11px] border border-line bg-surface px-4 text-[0.95rem] font-bold text-ink transition-colors group-hover:border-line-strong sm:ml-auto sm:w-auto"
          >
            Ver processo
            <ArrowRight className="size-[18px]" />
          </span>
        </div>
      </div>
    </article>
  );
}
