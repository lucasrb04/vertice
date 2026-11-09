import Link from "next/link";
import type { SituationCounts } from "@/lib/public/queries";
import { type VitrineParams, type VitrineSituation, vitrineHref } from "@/lib/public/search-params";
import { cn } from "@/lib/utils";

/**
 * Abas de situação: links (funcionam sem JavaScript e preservam os demais parâmetros), não controles de
 * formulário. `prefetch={false}`: o prefetch de links com `q` gastaria o limite de buscas.
 */
export function SituationTabs({ params, counts }: { params: VitrineParams; counts: SituationCounts }) {
  const tabs: { value: VitrineSituation; label: string; count: number }[] = [
    { value: "", label: params.includeClosed ? "Todos" : "Abertos", count: counts.all },
    { value: "encerrando", label: "Encerram em 7 dias", count: counts.closing },
    { value: "em-breve", label: "Abrem em breve", count: counts.soon },
  ];
  return (
    <nav
      aria-label="Situação das inscrições"
      className="flex max-w-full min-w-0 gap-1.5 overflow-x-auto rounded-[14px] bg-surface p-1.5 shadow-card [scrollbar-width:none] max-sm:w-full"
    >
      {tabs.map((t) => {
        const active = params.situation === t.value;
        return (
          <Link
            key={t.value || "todos"}
            href={vitrineHref(params, { situation: t.value })}
            prefetch={false}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-[10px] px-3.5 font-semibold whitespace-nowrap transition-colors duration-150",
              active ? "bg-ipe text-ink" : "hover:bg-fact",
            )}
          >
            {t.label}
            <span
              className={cn(
                "min-w-[26px] rounded-[7px] px-1.5 text-center text-[0.82rem] font-bold tabular-nums",
                active ? "bg-ink text-white" : "bg-[#ece7dd] text-ink",
              )}
            >
              {t.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
