import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { OpportunityCard } from "@/components/vitrine/opportunity-card";
import { SafeMarkdown } from "@/components/vitrine/safe-markdown";
import { CATEGORY_LABELS } from "@/lib/public/labels";
import { getPublicProject, type PublicCard } from "@/lib/public/queries";
import { getDefaultInstitution } from "@/lib/tenant";
import { isHttps } from "@/lib/validation/common";

// Prazos e estado aberto/encerrado mudam com o relógio: nunca pré-renderizar.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const loadProject = cache(async (slug: string) => {
  if (slug.length > 100 || slug.includes("\0")) return null;
  const institution = await getDefaultInstitution();
  return getPublicProject(institution.id, slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await loadProject((await params).slug);
  if (!result) return {};
  return { title: `${result.project.name} · Vértice`, description: result.project.shortDescription };
}

function CardGrid({ cards }: { cards: PublicCard[] }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={card.slug} className="min-w-0">
          <OpportunityCard card={card} />
        </li>
      ))}
    </ul>
  );
}

const LINK = "font-medium [overflow-wrap:anywhere] text-brand underline-offset-4 hover:underline";

export default async function ProjetoPage({ params }: Props) {
  const result = await loadProject((await params).slug);
  if (!result) notFound();
  const { project, open, closed } = result;

  const details: [string, string][] = [];
  if (project.institute) details.push(["Instituto", project.institute]);
  if (project.advisorName) details.push(["Orientação", project.advisorName]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-8 sm:py-10">
      <header className="space-y-3 border-b border-stone-200 pb-6">
        <p className="font-mono text-xs tracking-wide text-stone-500 uppercase">{CATEGORY_LABELS[project.category]}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="min-w-0 font-heading text-2xl leading-tight font-bold tracking-tight [word-spacing:0.06em] [overflow-wrap:anywhere] text-stone-900 sm:text-3xl">
            {project.name}
          </h1>
          {project.acronym && <span className="font-mono text-sm text-stone-600">{project.acronym}</span>}
          {project.verified && (
            <span className="inline-flex items-center gap-1 text-xs text-stone-600">
              <BadgeCheck aria-hidden className="size-3.5 text-brand" />
              Verificado
            </span>
          )}
        </div>
        {project.status === "ARCHIVED" && (
          <p className="inline-block rounded-md border border-stone-300 bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
            Projeto arquivado
          </p>
        )}
        <p className="max-w-3xl [overflow-wrap:anywhere] text-stone-600">{project.shortDescription}</p>
        {details.length > 0 && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="flex min-w-0 gap-1.5">
                <dt className="text-stone-500">{label}</dt>
                <dd className="min-w-0 font-medium [overflow-wrap:anywhere] text-stone-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {project.websiteUrl && isHttps(project.websiteUrl) && (
            <li>
              <a href={project.websiteUrl} target="_blank" rel="nofollow noopener noreferrer" className={LINK}>
                Site
              </a>
            </li>
          )}
          {project.instagramUrl && isHttps(project.instagramUrl) && (
            <li>
              <a href={project.instagramUrl} target="_blank" rel="nofollow noopener noreferrer" className={LINK}>
                Instagram
              </a>
            </li>
          )}
          <li className="min-w-0">
            <a href={`mailto:${project.contactEmail}`} className={LINK}>
              {project.contactEmail}
            </a>
          </li>
        </ul>
      </header>

      {project.description && (
        <section aria-labelledby="sobre" className="max-w-3xl">
          <h2 id="sobre" className="text-lg font-semibold tracking-tight text-stone-900">
            Sobre
          </h2>
          <div className="mt-3">
            <SafeMarkdown source={project.description} />
          </div>
        </section>
      )}

      <section aria-labelledby="abertos">
        <h2 id="abertos" className="text-lg font-semibold tracking-tight text-stone-900">
          Processos abertos <span className="font-mono text-sm font-normal text-stone-500">{open.length}</span>
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">Nenhum processo aberto no momento.</p>
        ) : (
          <CardGrid cards={open} />
        )}
      </section>

      {closed.length > 0 && (
        <section aria-labelledby="anteriores">
          <h2 id="anteriores" className="text-lg font-semibold tracking-tight text-stone-900">
            Processos anteriores <span className="font-mono text-sm font-normal text-stone-500">{closed.length}</span>
          </h2>
          <CardGrid cards={closed} />
        </section>
      )}
    </div>
  );
}
