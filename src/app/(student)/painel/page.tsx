import Link from "next/link";
import { Button } from "@/components/ui/button";
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

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-stone-900">Olá, {user.name}</h1>

      <div className="mt-10 grid gap-6 md:grid-cols-2 md:items-start">
        <section aria-labelledby="minhas-candidaturas" className="rounded-lg border border-stone-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone-200 px-5 py-4">
            <div>
              <h2 id="minhas-candidaturas" className="text-lg font-semibold tracking-tight text-stone-900">
                Minhas candidaturas
              </h2>
              {applications.length > 0 && (
                <p className="font-mono text-xs text-stone-600">
                  {inProgress === 0 ? "Nenhuma em andamento" : `${inProgress} em andamento`}
                </p>
              )}
            </div>
            {applications.length > 0 && (
              <Link
                href="/minhas-candidaturas"
                className="text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Ver todas
              </Link>
            )}
          </div>
          {applications.length === 0 ? (
            <div className="space-y-3 px-5 py-4 text-sm text-stone-600">
              <p>Você ainda não se candidatou a nenhum processo.</p>
              <Button asChild variant="outline">
                <Link href="/processos">Ver processos abertos</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-stone-200">
              {applications.slice(0, RECENT_APPLICATIONS).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere] text-stone-900">
                      {a.opportunityTitle}
                    </span>
                    <span className="block text-sm [overflow-wrap:anywhere] text-stone-600">{a.projectName}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-stone-900">
                    <span className="sr-only">Etapa: </span>
                    {APPLICATION_STATUS_LABELS[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="meus-projetos" className="rounded-lg border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-stone-200 px-5 py-4">
            <h2 id="meus-projetos" className="text-lg font-semibold tracking-tight text-stone-900">
              Meus projetos
            </h2>
            {projects.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/publicar">Publicar processo</Link>
              </Button>
            )}
          </div>
          {projects.length === 0 ? (
            <div className="space-y-3 px-5 py-4 text-sm text-stone-600">
              <p>Você ainda não participa de nenhum projeto.</p>
              <p>
                Lidera uma equipe, um laboratório ou um projeto? Publique o processo seletivo em poucos minutos e receba
                o link pronto para divulgar.
              </p>
              <Button asChild variant="outline">
                <Link href="/publicar">Publicar processo</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-stone-200">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projetos/${p.id}`} className="block space-y-1 px-5 py-3 hover:bg-stone-50">
                    <span className="flex items-start justify-between gap-4">
                      <span className="min-w-0">
                        <span className="font-medium [overflow-wrap:anywhere] text-stone-900">{p.name}</span>
                        {p.acronym && <span className="ml-2 font-mono text-xs text-stone-500">{p.acronym}</span>}
                        {p.status !== "ACTIVE" && (
                          <span className="ml-2 text-xs text-stone-600">{PROJECT_STATUS_LABELS[p.status]}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm text-stone-600">{ROLE_LABELS[p.role]}</span>
                    </span>
                    <span className="block font-mono text-xs text-stone-600">
                      {/* Cada número fica inteiro numa linha; a quebra só acontece entre eles. */}
                      {projectStatsParts(p.stats).map((part, i) => (
                        <span key={part}>
                          {i > 0 && " · "}
                          <span className="whitespace-nowrap">{part}</span>
                        </span>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
