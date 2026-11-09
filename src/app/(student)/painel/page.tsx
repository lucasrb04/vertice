import Link from "next/link";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { ProjectTile } from "@/components/vitrine/project-tile";
import { APPLICATION_STATUS_LABELS, IN_PROGRESS_STATUSES } from "@/lib/applications/labels";
import { listMyApplications } from "@/lib/applications/queries";
import { requireAuthPage } from "@/lib/auth/guards";
import { PROJECT_STATUS_LABELS, ROLE_LABELS } from "@/lib/projects/labels";
import { listMyProjects } from "@/lib/projects/queries";
import { projectStatsParts } from "@/lib/projects/stats";

const RECENT_APPLICATIONS = 3;

/**
 * Painel com duas metades de mesmo peso: a mesma pessoa pode ser candidata e recrutadora. Candidaturas vêm
 * primeiro para, no celular, o público mais numeroso ver a sua metade sem rolar.
 */
export default async function PainelPage() {
  const user = await requireAuthPage();
  const [applications, projects] = await Promise.all([listMyApplications(user), listMyProjects(user)]);
  const inProgress = applications.filter((a) => IN_PROGRESS_STATUSES.includes(a.status)).length;

  const panel = "rounded-2xl bg-surface shadow-card";
  const panelHead =
    "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4 sm:px-6";
  const panelTitle = "text-[1.2rem] font-bold text-ink";

  return (
    <Shell className="mt-8">
      <h1 className="text-[1.75rem] leading-tight font-extrabold [overflow-wrap:anywhere] text-ink">
        Olá, {user.name}
      </h1>

      <div className="mt-6 grid gap-5 md:grid-cols-2 md:items-start">
        <section aria-labelledby="minhas-candidaturas" className={panel}>
          <div className={panelHead}>
            <div>
              <h2 id="minhas-candidaturas" className={panelTitle}>
                Minhas candidaturas
              </h2>
              {applications.length > 0 && (
                <p className="text-sm text-ink-2">
                  {inProgress === 0 ? "Nenhuma em andamento" : `${inProgress} em andamento`}
                </p>
              )}
            </div>
            {applications.length > 0 && (
              <Link
                href="/minhas-candidaturas"
                className="font-semibold text-ink underline underline-offset-4 hover:decoration-2"
              >
                Ver todas
              </Link>
            )}
          </div>
          {applications.length === 0 ? (
            <div className="space-y-4 px-5 py-5 text-ink-2 sm:px-6">
              <p>Você ainda não se candidatou a nenhum processo.</p>
              <Button asChild>
                <Link href="/">Ver processos abertos</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {applications.slice(0, RECENT_APPLICATIONS).map((a) => (
                <li key={a.id} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6">
                  <ProjectTile category={a.projectCategory} name={a.projectName} acronym={a.projectAcronym} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold [overflow-wrap:anywhere] text-ink">{a.opportunityTitle}</span>
                    <span className="block text-sm [overflow-wrap:anywhere] text-ink-2">{a.projectName}</span>
                  </span>
                  <span className="shrink-0 rounded-[9px] bg-fact px-2.5 py-1 text-sm font-semibold text-ink">
                    <span className="sr-only">Etapa: </span>
                    {APPLICATION_STATUS_LABELS[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="meus-projetos" className={panel}>
          <div className={panelHead}>
            <h2 id="meus-projetos" className={panelTitle}>
              Meus projetos
            </h2>
            {projects.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/publicar">Publicar processo</Link>
              </Button>
            )}
          </div>
          {projects.length === 0 ? (
            <div className="space-y-3 px-5 py-5 text-ink-2 sm:px-6">
              <p>Você ainda não participa de nenhum projeto.</p>
              <p>
                Lidera uma equipe, um laboratório ou um projeto? Publique o processo seletivo em poucos minutos e receba
                o link pronto para divulgar.
              </p>
              <Button asChild>
                <Link href="/publicar">Publicar processo</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projetos/${p.id}`}
                    className="flex items-start gap-3.5 px-5 py-3.5 transition-colors last:rounded-b-2xl hover:bg-surface-2 sm:px-6"
                  >
                    <ProjectTile category={p.category} name={p.name} acronym={p.acronym} size="sm" />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-start justify-between gap-4">
                        <span className="min-w-0">
                          <span className="font-semibold [overflow-wrap:anywhere] text-ink">{p.name}</span>
                          {p.status !== "ACTIVE" && (
                            <span className="ml-2 text-sm text-ink-2">{PROJECT_STATUS_LABELS[p.status]}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-sm text-ink-2">{ROLE_LABELS[p.role]}</span>
                      </span>
                      <span className="block text-sm text-ink-2 tabular-nums">
                        {/* Cada número fica inteiro numa linha; a quebra só acontece entre eles. */}
                        {projectStatsParts(p.stats).map((part, i) => (
                          <span key={part}>
                            {i > 0 && " · "}
                            <span className="whitespace-nowrap">{part}</span>
                          </span>
                        ))}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}
