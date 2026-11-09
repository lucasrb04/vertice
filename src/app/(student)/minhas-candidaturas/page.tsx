import type { Metadata } from "next";
import Link from "next/link";
import { withdrawApplicationAction } from "@/actions/application.actions";
import { ApplicationFunnel } from "@/components/applications/application-funnel";
import { ConfirmActionButton } from "@/components/projects/confirm-action-button";
import { Button } from "@/components/ui/button";
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
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-stone-900">Minhas candidaturas</h1>
      {retirada !== undefined && (
        <p role="status" className="mt-6 rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm text-stone-800">
          Candidatura retirada.
        </p>
      )}
      {sent && (
        <section aria-labelledby="candidatura-enviada" className="mt-6 rounded-lg border border-stone-300 bg-white p-5">
          <h2 id="candidatura-enviada" className="text-base font-semibold text-stone-900">
            Candidatura enviada
          </h2>
          <p className="mt-1 text-sm [overflow-wrap:anywhere] text-stone-700">
            Sua candidatura para <strong className="font-medium text-stone-900">{sent.opportunityTitle}</strong> chegou
            à equipe de {sent.projectName}.
          </p>
          <p className="mt-2 text-sm text-stone-700">
            Próximas etapas: <span className="font-medium text-stone-900">Em análise</span>, depois{" "}
            <span className="font-medium text-stone-900">Entrevista</span> e o resultado. Você recebe um e-mail a cada
            mudança de etapa em <span className="font-mono text-xs">{user.email}</span>, e tudo fica registrado aqui.
          </p>
        </section>
      )}
      {applications.length === 0 ? (
        <div className="mt-6 space-y-3 text-sm text-stone-600">
          <p>Você ainda não se candidatou a nenhum processo.</p>
          <Button asChild variant="outline">
            <Link href="/">Ver processos abertos</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {applications.map((a) => (
            <li key={a.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  {a.opportunitySlug ? (
                    <Link
                      href={`/processo/${a.opportunitySlug}`}
                      className="font-medium [overflow-wrap:anywhere] text-stone-900 underline-offset-4 hover:text-brand hover:underline"
                    >
                      {a.opportunityTitle}
                    </Link>
                  ) : (
                    <span className="font-medium [overflow-wrap:anywhere] text-stone-900">{a.opportunityTitle}</span>
                  )}
                  <p className="text-sm [overflow-wrap:anywhere] text-stone-600">{a.projectName}</p>
                  {a.projectArchived && <p className="text-sm font-medium text-stone-700">Projeto arquivado</p>}
                </div>
                <p className="shrink-0 text-sm font-medium text-stone-900">
                  <span className="sr-only">Etapa: </span>
                  {APPLICATION_STATUS_LABELS[a.status]}
                </p>
              </div>
              <ApplicationFunnel status={a.status} />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="font-mono text-xs text-stone-500">Enviada em {formatDay(a.appliedAt)}</p>
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
              {a.messages.length > 0 && (
                <ul aria-label="Mensagens da equipe" className="space-y-2 border-l-2 border-stone-200 pl-4">
                  {a.messages.map((m, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, só de exibição, que não muda de ordem.
                    <li key={`${m.createdAt.toISOString()}-${i}`} className="text-sm">
                      <p className="font-mono text-xs text-stone-500">
                        {formatDay(m.createdAt)} · {APPLICATION_STATUS_LABELS[m.toStatus]}
                      </p>
                      <p className="whitespace-pre-line [overflow-wrap:anywhere] text-stone-800">{m.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
