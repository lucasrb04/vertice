import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Shell } from "@/components/layout/shell";
import { ReportDialog } from "@/components/moderation/report-dialog";
import { OpportunityCard } from "@/components/vitrine/opportunity-card";
import { ProjectTile } from "@/components/vitrine/project-tile";
import { SafeMarkdown } from "@/components/vitrine/safe-markdown";
import { getSessionUser } from "@/lib/auth/session";
import { canReport } from "@/lib/moderation/reports";
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

/** Se o visitante logado pode denunciar o projeto; sem sessão ou com sessão inválida, não. */
async function viewerCanReport(projectId: string): Promise<boolean> {
  try {
    const sessionUser = await getSessionUser();
    return sessionUser ? await canReport(sessionUser.id, { targetType: "PROJECT", targetId: projectId }) : false;
  } catch {
    // Sem o objeto do erro: o do Drizzle traz a consulta e os parâmetros.
    console.error("[projeto] falha ao consultar a sessão");
    return false;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await loadProject((await params).slug);
  if (!result) return {};
  return { title: `${result.project.name} · Vértice`, description: result.project.shortDescription };
}

function CardGrid({ cards }: { cards: PublicCard[] }) {
  return (
    <ul className="mt-4 grid gap-3.5">
      {cards.map((card) => (
        <li key={card.slug} className="min-w-0">
          <OpportunityCard card={card} />
        </li>
      ))}
    </ul>
  );
}

const LINK = "font-semibold [overflow-wrap:anywhere] text-ink underline underline-offset-4 hover:decoration-2";

export default async function ProjetoPage({ params }: Props) {
  const result = await loadProject((await params).slug);
  if (!result) notFound();
  const { project, projectId, open, closed } = result;
  // Página pública: a sessão é só consultada, nunca exigida.
  const reportable = await viewerCanReport(projectId);

  const details: [string, string][] = [];
  if (project.institute) details.push(["Instituto", project.institute]);
  if (project.advisorName) details.push(["Orientação", project.advisorName]);

  const card = "rounded-2xl bg-surface p-5 shadow-card sm:p-8";
  const sectionTitle = "text-[1.3rem] font-bold text-ink";

  return (
    <Shell className="mt-6 space-y-6">
      <header className={`${card} flex gap-4 sm:gap-5`}>
        <ProjectTile category={project.category} name={project.name} acronym={project.acronym} size="lg" />
        <div className="min-w-0 space-y-3">
          <div>
            <h1 className="text-[1.6rem] leading-[1.15] font-extrabold [overflow-wrap:anywhere] text-ink sm:text-[2.1rem]">
              {project.name}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-ink-2">
              {CATEGORY_LABELS[project.category]}
              {project.acronym && <span>· {project.acronym}</span>}
              {project.verified && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#2350b5]">
                  <BadgeCheck aria-hidden className="size-4" />
                  Verificado
                </span>
              )}
              {project.status === "ARCHIVED" && (
                <span className="rounded-[8px] bg-fact px-2 py-0.5 text-sm font-semibold text-ink">
                  Projeto arquivado
                </span>
              )}
            </p>
          </div>
          <p className="max-w-[70ch] text-[1.02rem] [overflow-wrap:anywhere] text-ink-2">{project.shortDescription}</p>
          {details.length > 0 && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1">
              {details.map(([label, value]) => (
                <div key={label} className="flex min-w-0 gap-1.5">
                  <dt className="text-ink-2">{label}</dt>
                  <dd className="min-w-0 font-semibold [overflow-wrap:anywhere] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
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
          {reportable && <ReportDialog targetType="PROJECT" targetId={projectId} />}
        </div>
      </header>

      {project.description && (
        <section aria-labelledby="sobre" className={card}>
          <h2 id="sobre" className={sectionTitle}>
            Sobre
          </h2>
          <div className="mt-3 max-w-[72ch]">
            <SafeMarkdown source={project.description} />
          </div>
        </section>
      )}

      <section aria-labelledby="abertos" className="pt-2">
        <h2 id="abertos" className={sectionTitle}>
          Processos abertos <span className="text-base font-semibold text-ink-3 tabular-nums">{open.length}</span>
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-surface p-5 text-ink-2 shadow-card">Nenhum processo aberto no momento.</p>
        ) : (
          <CardGrid cards={open} />
        )}
      </section>

      {closed.length > 0 && (
        <section aria-labelledby="anteriores" className="pt-2">
          <h2 id="anteriores" className={sectionTitle}>
            Processos anteriores{" "}
            <span className="text-base font-semibold text-ink-3 tabular-nums">{closed.length}</span>
          </h2>
          <CardGrid cards={closed} />
        </section>
      )}
    </Shell>
  );
}
