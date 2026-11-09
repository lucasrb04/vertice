import type { Metadata } from "next";
import { cookies } from "next/headers";
import { after } from "next/server";
import { Shell } from "@/components/layout/shell";
import { AutoSubmit } from "@/components/vitrine/auto-submit";
import { CorrectionNotice } from "@/components/vitrine/correction-notice";
import { EmptyResults } from "@/components/vitrine/empty-results";
import { FilterSheetProvider, FilterSheetTrigger } from "@/components/vitrine/filter-sheet";
import { activeChips, Filters } from "@/components/vitrine/filters";
import { OpportunityCard } from "@/components/vitrine/opportunity-card";
import { Pagination } from "@/components/vitrine/pagination";
import { PublishTip } from "@/components/vitrine/publish-tip";
import { SearchBox } from "@/components/vitrine/search-box";
import { SituationTabs } from "@/components/vitrine/situation-tabs";
import { SortSelect } from "@/components/vitrine/sort-select";
import { PUBLISH_TIP_COOKIE } from "@/lib/public/publish-tip";
import { listFilterOptions, searchOpportunities } from "@/lib/public/queries";
import { defaultSort, parseVitrineParams, type VitrineSort, vitrineHref } from "@/lib/public/search-params";
import { recordZeroResult, shouldLogZeroResult } from "@/lib/search/zero-results";
import { getDefaultInstitution } from "@/lib/tenant";

// Prazos e contagens mudam com o relógio: nunca pré-renderizar.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vértice — processos seletivos da UNIFEI" };

const FORM_ID = "filtros-processos";

const SORT_LABELS: Record<VitrineSort, string> = {
  relevance: "Relevância",
  recent: "Mais recentes",
  deadline: "Prazo mais próximo",
  popular: "Mais procurados",
};

const SORT_SUMMARY: Record<VitrineSort, string> = {
  relevance: "mais relevantes primeiro",
  recent: "mais recentes primeiro",
  deadline: "prazo mais próximo primeiro",
  popular: "mais procurados primeiro",
};

/**
 * A página inicial é a lista de processos (D51): painel de filtros, abas de situação e cards. Sem filtros,
 * todos os abertos, do último publicado para o mais antigo.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseVitrineParams(await searchParams);
  const institution = await getDefaultInstitution();
  const [result, options, cookieStore] = await Promise.all([
    searchOpportunities(institution.id, params),
    listFilterOptions(institution.id),
    cookies(),
  ]);
  const { items, total, page, pageCount, correction, situationCounts, categoryCounts } = result;

  // Agregado por termo e dia, sem usuário nem IP; a página não espera a gravação.
  if (shouldLogZeroResult(params, total)) {
    after(async () => {
      try {
        await recordZeroResult(institution.id, params.q);
      } catch (error) {
        // Erros do Drizzle trazem os parâmetros (o termo): registra só o código do Postgres.
        const code = (error as { cause?: { code?: string } } | null)?.cause?.code;
        console.error("[busca] falha ao registrar busca sem resultado", code ?? "");
      }
    });
  }

  const sortOptions: VitrineSort[] = params.q
    ? ["relevance", "recent", "deadline", "popular"]
    : ["recent", "deadline", "popular"];
  const sortValue = params.sort === "relevance" && !params.q ? defaultSort("") : params.sort;
  // O padrão vai como valor vazio: assim, buscar a partir de uma lista sem `q` cai em "Relevância".
  const sortParam = (s: VitrineSort) => (s === defaultSort(params.q) ? "" : s);

  const chips = activeChips(params, options);
  const filterCount = chips.filter((c) => c.key !== "q").length;
  const narrowed = chips.length > 0 || !!params.situation;
  const headline = narrowed
    ? `${total} ${total === 1 ? "processo encontrado" : "processos encontrados"}`
    : `${total} ${total === 1 ? "processo aberto" : "processos abertos"}`;
  const emptyKind =
    situationCounts.all === 0 && chips.length === 0
      ? "none"
      : params.situation && situationCounts.all > 0
        ? "tab"
        : "filtered";
  const selectedTags = params.tags.map((slug) => options.tags.find((t) => t.slug === slug)?.name ?? slug);
  const showTip = cookieStore.get(PUBLISH_TIP_COOKIE)?.value !== "0";

  return (
    <Shell className="mt-5 sm:mt-6">
      <form id={FORM_ID} method="get" action="/">
        <AutoSubmit formId={FORM_ID} />
        {/* Filtros e ordenação preservam a escolha de buscar exatamente; o AutoSubmit a descarta ao mudar `q`. */}
        {params.exact ? <input type="hidden" name="corrigir" value="0" /> : null}
        {params.situation ? <input type="hidden" name="situacao" value={params.situation} /> : null}
        <FilterSheetProvider>
          <div className="grid items-start gap-5 min-[1100px]:grid-cols-[340px_minmax(0,1fr)] min-[1100px]:gap-7">
            <Filters params={params} options={options} categoryCounts={categoryCounts} total={total} />

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-[18px]">
              {showTip && <PublishTip />}
              <SearchBox embedded autoFocusShortcut defaultValue={params.q} />

              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <SituationTabs params={params} counts={situationCounts} />
                <FilterSheetTrigger activeCount={filterCount} />
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <label htmlFor="ordenacao" className="text-[0.95rem] whitespace-nowrap text-ink-2 max-sm:sr-only">
                    Ordenar por
                  </label>
                  <SortSelect
                    value={sortParam(sortValue)}
                    options={sortOptions.map((s) => ({ value: sortParam(s), label: SORT_LABELS[s] }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-2 text-[1.02rem] text-ink-2">
                <h1 className="text-[1.15rem] font-bold text-ink">{headline}</h1>
                {total > 0 && <p>· {SORT_SUMMARY[sortValue]}</p>}
              </div>

              {correction ? <CorrectionNotice params={params} correction={correction} /> : null}
              {items.length === 0 ? (
                <EmptyResults kind={emptyKind} allHref={vitrineHref(params, { situation: "" })} />
              ) : (
                <>
                  <h2 className="sr-only">Resultados</h2>
                  <ul className="grid gap-3.5">
                    {items.map((card) => (
                      <li key={card.slug} className="min-w-0">
                        <OpportunityCard card={card} q={params.q} selectedTags={selectedTags} />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <Pagination params={params} page={page} pageCount={pageCount} />
                  </div>
                </>
              )}
            </div>
          </div>
        </FilterSheetProvider>
      </form>
    </Shell>
  );
}
