import type { Metadata } from "next";
import { after } from "next/server";
import { AutoSubmit } from "@/components/vitrine/auto-submit";
import { CorrectionNotice } from "@/components/vitrine/correction-notice";
import { EmptyResults } from "@/components/vitrine/empty-results";
import { Filters } from "@/components/vitrine/filters";
import { OpportunityCard } from "@/components/vitrine/opportunity-card";
import { Pagination } from "@/components/vitrine/pagination";
import { SearchBox } from "@/components/vitrine/search-box";
import { SortSelect } from "@/components/vitrine/sort-select";
import { listFilterOptions, searchOpportunities } from "@/lib/public/queries";
import { defaultSort, parseVitrineParams, type VitrineSort } from "@/lib/public/search-params";
import { recordZeroResult, shouldLogZeroResult } from "@/lib/search/zero-results";
import { getDefaultInstitution } from "@/lib/tenant";

// Prazos e contagens mudam com o relógio: nunca pré-renderizar.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Processos seletivos · Vértice" };

const FORM_ID = "filtros-processos";

const SORT_LABELS: Record<VitrineSort, string> = {
  relevance: "Relevância",
  recent: "Mais recentes",
  deadline: "Prazo mais próximo",
  popular: "Mais procurados",
};

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseVitrineParams(await searchParams);
  const institution = await getDefaultInstitution();
  const [result, options] = await Promise.all([
    searchOpportunities(institution.id, params),
    listFilterOptions(institution.id),
  ]);
  const { items, total, page, pageCount, correction } = result;

  // Agregado por termo e dia, sem usuário nem IP; a página não espera a gravação.
  if (shouldLogZeroResult(params, total)) {
    after(async () => {
      try {
        await recordZeroResult(institution.id, params.q);
      } catch (error) {
        console.error("[busca] falha ao registrar busca sem resultado", error);
      }
    });
  }

  const sortOptions: VitrineSort[] = params.q
    ? ["relevance", "recent", "deadline", "popular"]
    : ["recent", "deadline", "popular"];
  const sortValue = params.sort === "relevance" && !params.q ? defaultSort("") : params.sort;
  // O padrão vai como valor vazio: assim, buscar a partir de uma lista sem `q` cai em "Relevância".
  const sortParam = (s: VitrineSort) => (s === defaultSort(params.q) ? "" : s);
  const filtered =
    !!params.q ||
    params.categories.length > 0 ||
    !!params.scholarship ||
    !!params.course ||
    params.tags.length > 0 ||
    params.includeClosed;

  return (
    <form id={FORM_ID} method="get" action="/processos" className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <AutoSubmit formId={FORM_ID} />
      {/* Filtros e ordenação preservam a escolha de buscar exatamente; o AutoSubmit a descarta ao mudar `q`. */}
      {params.exact ? <input type="hidden" name="corrigir" value="0" /> : null}
      <h1 className="text-[1.75rem] leading-[1.15] font-bold tracking-[-0.02em] text-stone-900 [word-spacing:0.06em]">
        <span className="font-mono">{total}</span> {total === 1 ? "processo seletivo" : "processos seletivos"}
      </h1>

      <div className="mt-5 max-w-2xl">
        <SearchBox embedded defaultValue={params.q} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <aside aria-label="Filtros">
          <Filters params={params} options={options} />
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-end gap-2">
            <label htmlFor="ordenacao" className="text-sm text-stone-600">
              Ordenar por
            </label>
            <SortSelect
              value={sortParam(sortValue)}
              options={sortOptions.map((s) => ({ value: sortParam(s), label: SORT_LABELS[s] }))}
            />
          </div>

          {correction ? <CorrectionNotice params={params} correction={correction} /> : null}
          <h2 className="sr-only">Resultados</h2>
          {items.length === 0 ? (
            <EmptyResults filtered={filtered} />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((card) => (
                  <li key={card.slug} className="min-w-0">
                    <OpportunityCard card={card} />
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Pagination params={params} page={page} pageCount={pageCount} />
              </div>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
