import type { Metadata } from "next";
import Link from "next/link";
import { withdrawApplicationAction } from "@/actions/application.actions";
import { ApplicationFunnel } from "@/components/applications/application-funnel";
import { Shell } from "@/components/layout/shell";
import { ConfirmActionButton } from "@/components/projects/confirm-action-button";
import { Button } from "@/components/ui/button";
import { ProjectTile } from "@/components/vitrine/project-tile";
import { APPLICATION_STATUS_LABELS, IN_PROGRESS_STATUSES } from "@/lib/applications/labels";
import { listMyApplications } from "@/lib/applications/queries";
import { requireAuthPage } from "@/lib/auth/guards";
import { formatDay } from "@/lib/time";

export const metadata: Metadata = { title: "Minhas candidaturas · Vértice" };

// Depende da sessão.
export const dynamic = "force-dynamic";

export default async function MinhasCandidaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ enviada?: string | string[]; retirada?: string | string[] }>;
}) {
  const user = await requireAuthPage("/minhas-candidaturas");
  const applications = await listMyApplications(user);
  // Fim da jornada do aluno: `?enviada=<slug>` só vale para uma candidatura dele; nada da URL é mostrado.
  const { enviada, retirada } = await searchParams;
  const sentSlug = Array.isArray(enviada) ? enviada[0] : enviada;
  const sent = sentSlug ? applications.find((a) => a.opportunitySlug === sentSlug) : undefined;

  return (
    <Shell className="mt-8 max-w-[880px]">
      <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">Minhas candidaturas</h1>
      {retirada !== undefined && (
        <p role="status" className="mt-5 rounded-xl bg-surface px-5 py-3 font-medium text-ink shadow-card">
          Candidatura retirada.
        </p>
      )}
      {sent && (
        <section aria-labelledby="candidatura-enviada" className="mt-5 rounded-2xl bg-money-soft p-5 sm:p-6">
          <h2 id="candidatura-enviada" className="font-sans text-[1.05rem] font-bold tracking-normal text-money-ink">
            Candidatura enviada
          </h2>
          <p className="mt-1 [overflow-wrap:anywhere] text-ink">
            Sua candidatura para <strong className="font-semibold">{sent.opportunityTitle}</strong> chegou à equipe de{" "}
            {sent.projectName}.
          </p>
          <p className="mt-2 text-ink-2">
            Próximas etapas: <span className="font-semibold text-ink">Em análise</span>, depois{" "}
            <span className="font-semibold text-ink">Entrevista</span> e o resultado. Você recebe um e-mail a cada
            mudança de etapa em <span className="font-medium text-ink">{user.email}</span>, e tudo fica registrado aqui.
          </p>
        </section>
      )}
      {applications.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-surface p-6 shadow-card">
          <p className="text-ink-2">Você ainda não se candidatou a nenhum processo.</p>
          <Button asChild className="mt-4">
            <Link href="/">Ver processos abertos</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3.5">
          {applications.map((a) => (
            <li key={a.id} className="rounded-2xl bg-surface p-4 shadow-card sm:p-6">
              <div className="flex gap-3.5 sm:gap-[18px]">
                <ProjectTile category={a.projectCategory} name={a.projectName} acronym={a.projectAcronym} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <h2 className="text-[1.15rem] leading-tight font-bold [overflow-wrap:anywhere] sm:text-[1.25rem]">
                        {a.opportunitySlug ? (
                          <Link href={`/processo/${a.opportunitySlug}`} className="underline-offset-4 hover:underline">
                            {a.opportunityTitle}
                          </Link>
                        ) : (
                          a.opportunityTitle
                        )}
                      </h2>
                      <p className="mt-0.5 [overflow-wrap:anywhere] text-ink-2">{a.projectName}</p>
                      {a.projectArchived && <p className="text-sm font-semibold text-ink">Projeto arquivado</p>}
                    </div>
                    <p className="shrink-0 rounded-[9px] bg-fact px-2.5 py-1 text-sm font-semibold text-ink">
                      <span className="sr-only">Etapa: </span>
                      {APPLICATION_STATUS_LABELS[a.status]}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-4 sm:pl-[78px]">
                <ApplicationFunnel status={a.status} />
                {a.messages.length > 0 && (
                  <ul aria-label="Mensagens da equipe" className="space-y-2">
                    {a.messages.map((m, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, só de exibição, que não muda de ordem.
                      <li key={`${m.createdAt.toISOString()}-${i}`} className="rounded-xl bg-surface-2 px-4 py-3">
                        <p className="text-sm text-ink-3">
                          {formatDay(m.createdAt)} · {APPLICATION_STATUS_LABELS[m.toStatus]}
                        </p>
                        <p className="mt-0.5 whitespace-pre-line [overflow-wrap:anywhere] text-ink">{m.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#f0ebe2] pt-3.5">
                  <p className="text-sm text-ink-3">Enviada em {formatDay(a.appliedAt)}</p>
                  {IN_PROGRESS_STATUSES.includes(a.status) && (
                    <ConfirmActionButton
                      label="Retirar candidatura"
                      srLabel={`(${a.opportunityTitle})`}
                      title="Retirar esta candidatura?"
                      description={`Sua candidatura para ${a.opportunityTitle} sai do processo. A equipe deixa de ver seus dados e a sua resposta. Se as inscrições ainda estiverem abertas, você pode se candidatar de novo.`}
                      confirmLabel="Retirar candidatura"
                      cancelLabel="Manter"
                      action={withdrawApplicationAction.bind(null, a.id)}
                      redirectTo="/minhas-candidaturas?retirada=1"
                      variant="ghost"
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
