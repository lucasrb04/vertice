import { BadgeCheck, BriefcaseBusiness, CalendarClock, Clock, HandHeart, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { Shell } from "@/components/layout/shell";
import { ReportDialog } from "@/components/moderation/report-dialog";
import { Button } from "@/components/ui/button";
import { ProjectTile } from "@/components/vitrine/project-tile";
import { Requirements } from "@/components/vitrine/requirements";
import { SafeMarkdown } from "@/components/vitrine/safe-markdown";
import { Schedule } from "@/components/vitrine/schedule";
import { getMyApplicationId } from "@/lib/applications/queries";
import { getSessionUser } from "@/lib/auth/session";
import { logError } from "@/lib/log";
import { canReport } from "@/lib/moderation/reports";
import { opensInFuture, opensOnLabel } from "@/lib/opportunities/status";
import { deadlineLabel } from "@/lib/projects/labels";
import { CATEGORY_LABELS, cardScholarshipLabel, deadlineChip, plainTextExcerpt } from "@/lib/public/labels";
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

type Viewer = { signedIn: boolean; myApplicationId: string | null; canReport: boolean };
const ANONYMOUS: Viewer = { signedIn: false, myApplicationId: null, canReport: false };

/** Candidatura do visitante logado e se ele pode denunciar; sem sessão ou com sessão inválida, nada. */
async function findViewer(opportunity: { id: string; internalSelectionEnabled: boolean }): Promise<Viewer> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return ANONYMOUS;
    const [myApplicationId, reportable] = await Promise.all([
      opportunity.internalSelectionEnabled ? getMyApplicationId(sessionUser.id, opportunity.id) : null,
      canReport(sessionUser.id, { targetType: "OPPORTUNITY", targetId: opportunity.id }),
    ]);
    return { signedIn: true, myApplicationId, canReport: reportable };
  } catch {
    // Sem o objeto do erro: o do Drizzle traz a consulta e os parâmetros.
    console.error("[processo] falha ao consultar a sessão");
    return ANONYMOUS;
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
        logError("[telemetria] falha ao registrar visualização", error);
      }
    });
  }

  // Página pública: a sessão é só consultada, nunca exigida; os dados públicos acima não dependem dela.
  const { signedIn, myApplicationId, canReport: reportable } = await findViewer(opportunity);

  const editalHref = opportunity.externalUrl && isHttps(opportunity.externalUrl) ? `/processo/${slug}/edital` : null;
  const opensLater = isOpen && opensInFuture(opportunity.applicationsOpenOn);
  const urgency = isOpen ? deadlineChip(opportunity.deadlineAt) : null;
  const paid = opportunity.scholarshipType !== "VOLUNTARY";
  const facts: { icon: typeof Clock; text: string; money?: boolean }[] = [
    { icon: paid ? Wallet : HandHeart, text: cardScholarshipLabel(opportunity), money: paid },
  ];
  if (opportunity.weeklyHours) facts.push({ icon: Clock, text: `${opportunity.weeklyHours} h por semana` });
  if (opportunity.vacanciesCount) {
    facts.push({
      icon: Users,
      text: opportunity.vacanciesCount === 1 ? "1 vaga" : `${opportunity.vacanciesCount} vagas`,
    });
  }
  if (opportunity.roleArea) facts.push({ icon: BriefcaseBusiness, text: opportunity.roleArea });
  const tagGroups = TAG_GROUPS.filter(([key]) => tags[key].length > 0);

  const sectionCard = "rounded-2xl bg-surface p-5 shadow-card sm:p-8";
  const sideLink = "block font-semibold text-ink underline underline-offset-4 hover:decoration-2";

  return (
    <Shell className="mt-6">
      {/* Celular: cabeçalho, inscrição e conteúdo, nessa ordem; desktop: inscrição fixa à direita. */}
      <article className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7">
        <header className={cn(sectionCard, "flex gap-4 sm:gap-5 lg:col-start-1")}>
          <ProjectTile category={project.category} name={project.name} acronym={project.acronym} size="lg" />
          <div className="min-w-0">
            <h1 className="text-[1.6rem] leading-[1.15] font-extrabold [overflow-wrap:anywhere] text-ink sm:text-[2.1rem]">
              {opportunity.title}
            </h1>
            <p className="mt-2 text-base [overflow-wrap:anywhere]">
              <Link
                href={`/projeto/${project.slug}`}
                className="font-semibold text-ink underline-offset-4 hover:underline"
              >
                {project.name}
              </Link>
              {project.verified && (
                <span className="ml-1.5 inline-flex items-center gap-1 align-[-2px] text-sm font-medium text-[#2350b5]">
                  <BadgeCheck aria-hidden className="size-4" />
                  Verificado
                </span>
              )}{" "}
              <span className="whitespace-nowrap text-ink-2">· {CATEGORY_LABELS[project.category]}</span>
            </p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Resumo">
              {facts.map(({ icon: Icon, text, money }) => (
                <li
                  key={text}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-[0.94rem] font-medium",
                    money ? "bg-money-soft text-money-ink" : "bg-fact",
                  )}
                >
                  <Icon aria-hidden className={cn("size-4 shrink-0", money ? "text-money-ink" : "text-ink-2")} />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </header>

        <aside
          aria-label="Inscrição"
          className="space-y-4 lg:sticky lg:top-5 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          {isOpen ? (
            <div className="space-y-4 rounded-2xl bg-surface p-5 shadow-card">
              {opensLater && (
                <p className="inline-flex items-center gap-1.5 rounded-[9px] bg-rosa-soft px-2.5 py-1 font-semibold text-rosa-ink">
                  {opensOnLabel(opportunity.applicationsOpenOn!)}
                </p>
              )}
              <div>
                <p
                  className={cn(
                    "inline-flex items-center gap-2 text-[1.15rem] font-bold",
                    urgency!.urgent ? "rounded-[10px] bg-urgent-soft px-3 py-1.5 text-urgent-ink" : "text-ink",
                  )}
                >
                  <CalendarClock aria-hidden className="size-5" />
                  {urgency!.text}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{deadlineLabel(opportunity.deadlineAt)}</p>
              </div>
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
                  // Quem exige o login é a página de candidatura; aqui só avisamos antes do clique.
                  <>
                    <Button asChild size="lg" className="w-full">
                      <Link href={`/processo/${slug}/candidatar`}>Candidatar-se</Link>
                    </Button>
                    {!signedIn && (
                      <p className="text-sm leading-relaxed text-ink-2">
                        Para se candidatar, você entra com a sua conta Google @unifei.edu.br.
                      </p>
                    )}
                  </>
                ))}
              {editalHref && (
                <Button
                  asChild
                  size="lg"
                  variant={opportunity.internalSelectionEnabled ? "outline" : "default"}
                  className="w-full"
                >
                  <a href={editalHref} target="_blank" rel="nofollow noopener">
                    Acessar edital
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 rounded-2xl bg-surface-2 p-5 text-ink-2 shadow-card">
              <p role="status" className="text-[1.1rem] font-bold text-ink">
                Processo encerrado
                {closedOn && (
                  <>
                    {" em "}
                    <span className="tabular-nums">{formatDay(closedOn)}</span>
                  </>
                )}
              </p>
              <Link href={`/projeto/${project.slug}`} className={sideLink}>
                Ver outros processos do projeto
              </Link>
              {myApplicationId && (
                <Link href="/minhas-candidaturas" className={sideLink}>
                  Ver minha candidatura
                </Link>
              )}
              {editalHref && (
                <a href={editalHref} target="_blank" rel="nofollow noopener" className={sideLink}>
                  Acessar edital
                </a>
              )}
            </div>
          )}

          {reportable && (
            <div className="px-1">
              <ReportDialog targetType="OPPORTUNITY" targetId={opportunity.id} />
            </div>
          )}
        </aside>

        <div className={cn(sectionCard, "min-w-0 space-y-9 lg:col-start-1")}>
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
              <h2 id="tags" className="text-[1.2rem] font-bold text-ink">
                Temas e habilidades
              </h2>
              {tagGroups.map(([key, label]) => (
                <div key={key}>
                  <h3 className="font-sans text-sm font-semibold tracking-normal text-ink-2">{label}</h3>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {tags[key].map((tag) => (
                      <li
                        key={tag.slug}
                        className="max-w-full truncate rounded-full border border-line px-3 py-0.5 text-[0.9rem] text-ink-2"
                      >
                        {tag.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>
      </article>
    </Shell>
  );
}
