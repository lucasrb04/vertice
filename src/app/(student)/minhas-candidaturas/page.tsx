import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listMyApplications } from "@/lib/applications/queries";
import { APPLICATION_STATUS_LABELS } from "@/lib/applications/labels";
import { requireAuthPage } from "@/lib/auth/guards";
import { formatDay } from "@/lib/time";

export const metadata: Metadata = { title: "Minhas candidaturas · Vértice" };

// Depende da sessão.
export const dynamic = "force-dynamic";

export default async function MinhasCandidaturasPage() {
  const user = await requireAuthPage("/minhas-candidaturas");
  const applications = await listMyApplications(user);

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-stone-900">Minhas candidaturas</h1>
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
              <p className="font-mono text-xs text-stone-500">Enviada em {formatDay(a.appliedAt)}</p>
              {a.messages.length > 0 && (
                <ul aria-label="Mensagens da equipe" className="space-y-2 border-l-2 border-stone-200 pl-4">
                  {a.messages.map((m, i) => (
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
