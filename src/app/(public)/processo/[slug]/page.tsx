import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Requirements } from "@/components/vitrine/requirements";
import { SafeMarkdown } from "@/components/vitrine/safe-markdown";
import { Schedule } from "@/components/vitrine/schedule";
import { getMyApplicationId } from "@/lib/applications/queries";
import { getSessionUser } from "@/lib/auth/session";
import { opensInFuture, opensOnLabel } from "@/lib/opportunities/status";
import { deadlineLabel } from "@/lib/projects/labels";
import {
  CATEGORY_LABELS,
  deadlineChip,
  formatCents,
  plainTextExcerpt,
  scholarshipSummary,
} from "@/lib/public/labels";
import { getPublicOpportunity } from "@/lib/public/queries";
import { getVisitorHashSecret, recordView, visitorHash } from "@/lib/public/telemetry";
import { getRequestIp } from "@/lib/security/audit";
import { getDefaultInstitution } from "@/lib/tenant";
import { formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { isHttps } from "@/lib/validation/common";

// Prazos e estado aberto/encerrado mudam com o relógio: nunca pré-renderizar.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Candidatura do visitante logado a este processo; sem sessão ou com sessão inválida, nulo. */
async function findMyApplicationId(opportunityId: string): Promise<string | null> {
  try {
    const sessionUser = await getSessionUser();
    return sessionUser ? await getMyApplicationId(sessionUser.id, opportunityId) : null;
  } catch (error) {
    console.error("[processo] falha ao consultar a sessão", error);
    return null;
  }
}

/** `cache` para metadados e página dividirem a mesma leitura na requisição. */
const loadOpportunity = cache(async (slug: string) => {
  if (slug.length > 140 || slug.includes("\0")) return null;
  const institution = await getDefaultInstitution();
  return getPublicOpportunity(institution.id, slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await loadOpportunity((await params).slug);
  if (!result) return {};
  return {
    title: `${result.opportunity.title} · Vértice`,
    description: plainTextExcerpt(result.opportunity.description),
  };
}

const TAG_GROUPS = [
  ["THEME", "Temas"],
  ["DESIRED_SKILL", "Habilidades desejadas"],
  ["DEVELOPED_SKILL", "Habilidades desenvolvidas"],
] as const;

export default async function ProcessoPage({ params }: Props) {
  const { slug } = await params;
  const result = await loadOpportunity(slug);
  if (!result) notFound();
  const { opportunity, project, courses, tags, isOpen, closedOn } = result;

  // `after` não pode ler `headers()`; o hash fica lá dentro para nenhuma falha alcançar a página.
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent");
  // Prefetch do roteador não é visita: não conta visualização.
  if (!requestHeaders.has("next-router-prefetch")) {
    after(async () => {
      try {
        await recordView(opportunity.id, visitorHash(ip, userAgent, getVisitorHashSecret()));
      } catch (error) {
        console.error("[telemetria] falha ao registrar visualização", error);
      }
    });
  }

  // Página pública: a sessão é só consultada, nunca exigida; os dados públicos acima não dependem dela.
  const myApplicationId = opportunity.internalSelectionEnabled ? await findMyApplicationId(opportunity.id) : null;

  const editalHref = opportunity.externalUrl && isHttps(opportunity.externalUrl) ? `/processo/${slug}/edital` : null;
  const opensLater = isOpen && opensInFuture(opportunity.applicationsOpenOn);
  const urgency = isOpen ? deadlineChip(opportunity.deadlineAt) : null;
  const facts: [string, string][] = [["Modalidade", scholarshipSummary(opportunity)]];
  if (opportunity.scholarshipValueCents) facts.push(["Valor", formatCents(opportunity.scholarshipValueCents)]);
  if (opportunity.weeklyHours) facts.push(["Carga", `${opportunity.weeklyHours}h/sem`]);
  if (opportunity.vacanciesCount) facts.push(["Vagas", String(opportunity.vacanciesCount)]);
  if (opportunity.roleArea) facts.push(["Área", opportunity.roleArea]);
  const tagGroups = TAG_GROUPS.filter(([key]) => tags[key].length > 0);

  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <header className="border-b border-stone-200 pb-6">
        <p className="font-mono text-xs tracking-wide text-stone-500 uppercase">{CATEGORY_LABELS[project.category]}</p>
        <h1 className="mt-2 font-heading text-2xl leading-tight font-bold tracking-tight [word-spacing:0.06em] [overflow-wrap:anywhere] text-stone-900 sm:text-3xl">
          {opportunity.title}
        </h1>
        <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Link
            href={`/projeto/${project.slug}`}
            className="min-w-0 font-medium [overflow-wrap:anywhere] text-stone-800 underline-offset-4 hover:text-brand hover:underline"
          >
            {project.name}
          </Link>
          {project.acronym && <span className="font-mono text-xs text-stone-600">{project.acronym}</span>}
          {project.verified && (
            <span className="inline-flex items-center gap-1 text-xs text-stone-600">
              <BadgeCheck aria-hidden className="size-3.5 text-brand" />
              Verificado
            </span>
          )}
        </p>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
        <aside aria-label="Inscrição" className="space-y-5 lg:col-start-2 lg:row-start-1">
          {isOpen ? (
            <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
              {opensLater && (
                <p className="font-mono text-sm font-medium text-stone-900">{opensOnLabel(opportunity.applicationsOpenOn!)}</p>
              )}
              <p className={cn("font-mono text-sm font-medium", urgency!.urgent ? "text-amber-700" : "text-stone-900")}>
                {urgency!.text}
              </p>
              <p className="font-mono text-xs leading-relaxed text-stone-600">{deadlineLabel(opportunity.deadlineAt)}</p>
              {opportunity.internalSelectionEnabled &&
                (myApplicationId ? (
                  <Button asChild size="lg" className="w-full">
                    <Link href="/minhas-candidaturas">Ver minha candidatura</Link>
                  </Button>
                ) : opensLater ? (
                  <Button size="lg" className="w-full" disabled>
                    Candidaturas abrem em {opportunity.applicationsOpenOn!.slice(8, 10)}/
                    {opportunity.applicationsOpenOn!.slice(5, 7)}
                  </Button>
                ) : (
                  // Página pública: sem sessão aqui; quem decide o login é a página de candidatura.
                  <Button asChild size="lg" className="w-full">
                    <Link href={`/processo/${slug}/candidatar`}>Candidatar-se</Link>
                  </Button>
                ))}
              {editalHref && (
                <Button asChild size="lg" variant={opportunity.internalSelectionEnabled ? "outline" : "default"} className="w-full">
                  <a href={editalHref} target="_blank" rel="nofollow noopener">
                    Acessar edital
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-stone-300 bg-stone-100 p-4 text-sm text-stone-700">
              <p role="status" className="font-medium text-stone-900">
                Processo encerrado
                {closedOn && (
                  <>
                    {" em "}
                    <span className="font-mono">{formatDay(closedOn)}</span>
                  </>
                )}
              </p>
              <Link
                href={`/projeto/${project.slug}`}
                className="block font-medium text-brand underline-offset-4 hover:underline"
              >
                Ver outros processos do projeto
              </Link>
              {myApplicationId && (
                <Link
                  href="/minhas-candidaturas"
                  className="block font-medium text-brand underline-offset-4 hover:underline"
                >
                  Ver minha candidatura
                </Link>
              )}
              {editalHref && (
                <a
                  href={editalHref}
                  target="_blank"
                  rel="nofollow noopener"
                  className="block text-stone-600 underline underline-offset-4 hover:text-stone-900"
                >
                  Acessar edital
                </a>
              )}
            </div>
          )}

          <dl className="divide-y divide-stone-200 border-y border-stone-200 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="text-stone-600">{label}</dt>
                <dd className="min-w-0 text-right font-mono [overflow-wrap:anywhere] text-stone-900">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
          <section aria-labelledby="sobre">
            <h2 id="sobre" className="sr-only">
              Sobre o processo
            </h2>
            <SafeMarkdown source={opportunity.description} />
          </section>

          <Schedule dates={opportunity} />

          <Requirements
            courses={courses}
            minSemester={opportunity.minSemester}
            maxSemester={opportunity.maxSemester}
            availability={opportunity.availabilityRequirement}
            noOtherScholarship={opportunity.noOtherScholarship}
          />

          {tagGroups.length > 0 && (
            <section aria-labelledby="tags" className="space-y-3">
              <h2 id="tags" className="text-lg font-semibold tracking-tight text-stone-900">
                Tags
              </h2>
              {tagGroups.map(([key, label]) => (
                <div key={key}>
                  <h3 className="text-sm text-stone-600">{label}</h3>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {tags[key].map((tag) => (
                      <li key={tag.slug} className="max-w-full min-w-0">
                        <Badge
                          variant="secondary"
                          className="block h-auto max-w-full truncate rounded-md font-mono font-normal text-stone-700"
                        >
                          {tag.name}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
