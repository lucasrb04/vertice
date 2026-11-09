import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeRow } from "@/components/vitrine/home-row";
import { SearchBox } from "@/components/vitrine/search-box";
import type { ProjectCategory } from "@/lib/projects/labels";
import { CATEGORY_LABELS } from "@/lib/public/labels";
import { listHomeRows } from "@/lib/public/queries";
import { getDefaultInstitution } from "@/lib/tenant";
import { PROJECT_CATEGORIES } from "@/lib/validation/project";

// Prazos e contagens mudam com o relógio: nunca pré-renderizar.
export const dynamic = "force-dynamic";

// Mesma ordem dos filtros; "Outro" não vira atalho.
const CATEGORY_SHORTCUTS: ProjectCategory[] = PROJECT_CATEGORIES.filter((c) => c !== "OTHER");

export default async function Home() {
  const institution = await getDefaultInstitution();
  const { openCount, recent, closing, popular } = await listHomeRows(institution.id);

  return (
    <>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-14">
          <div>
            <h1 className="max-w-3xl text-[1.75rem] leading-[1.15] font-bold tracking-[-0.02em] text-balance [word-spacing:0.06em] text-stone-900 sm:text-[2.5rem]">
              Encontre o projeto que vai impulsionar sua trajetória.
            </h1>
            <p className="mt-3 max-w-2xl text-pretty text-stone-600">
              Iniciação científica, extensão, equipes de competição, PETs e empresas juniores da UNIFEI em um só lugar,
              com prazos e requisitos. Para ver os processos e abrir os editais, não precisa de conta.
            </p>
            <div className="mt-6 max-w-2xl">
              <SearchBox autoFocusShortcut />
            </div>
          </div>

          <div className="lg:border-l lg:border-stone-200 lg:pl-6">
            {openCount > 0 && (
              <p className="mb-3 tabular-nums text-xs text-stone-600 lg:mb-2">
                {openCount} {openCount === 1 ? "processo aberto" : "processos abertos"}
              </p>
            )}
            <nav aria-label="Categorias">
              <ul className="flex flex-wrap gap-1.5 lg:block lg:divide-y lg:divide-stone-100">
                {CATEGORY_SHORTCUTS.map((category) => (
                  <li key={category}>
                    <Link
                      href={`/processos?category=${category}`}
                      className="block rounded-md border border-stone-200 px-2.5 py-1 text-sm text-stone-700 hover:border-stone-400 hover:text-stone-900 lg:rounded-none lg:border-0 lg:px-0 lg:py-1.5 lg:hover:text-brand"
                    >
                      {CATEGORY_LABELS[category]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:py-10">
        {openCount === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white px-5 py-8">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-stone-900 [word-spacing:0.06em]">
              Nenhum processo aberto agora
            </h2>
            <p className="mt-1 max-w-prose text-sm text-stone-600">
              Quando um projeto da UNIFEI abrir inscrições, ele aparece aqui. Faz parte de um projeto? Publique o
              primeiro processo.
            </p>
            <Button asChild className="mt-4">
              <Link href="/publicar">Publicar processo</Link>
            </Button>
          </div>
        ) : (
          <>
            <HomeRow title="Últimos publicados" href="/processos?sort=recent" cards={recent} />
            <HomeRow title="Encerrando em breve" href="/processos?sort=deadline" cards={closing} />
            <HomeRow title="Mais procurados" href="/processos?sort=popular" cards={popular} />
          </>
        )}
      </div>
    </>
  );
}
