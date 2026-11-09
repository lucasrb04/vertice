"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ModerationDialog } from "@/components/moderation/moderation-dialog";
import type { QueueItem, TargetRow } from "@/lib/moderation/queries";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/labels";
import { REPORT_REASON_LABELS } from "@/lib/validation/moderation";

const TYPE_LABELS = { PROJECT: "Projeto", OPPORTUNITY: "Processo" } as const;
const CONTENT_SEGMENTS = { PROJECT: "projeto", OPPORTUNITY: "processo" } as const;
const OPPORTUNITY_STATUS_LABELS = {
  OPEN: "Aberto",
  PAUSED: "Pausado",
  UNDER_REVIEW: "Oculto pela moderação",
  CLOSED: "Encerrado",
} as const;

function statusLabel(row: TargetRow): string {
  if (row.targetType === "OPPORTUNITY")
    return OPPORTUNITY_STATUS_LABELS[row.status as keyof typeof OPPORTUNITY_STATUS_LABELS];
  return row.hidden ? "Oculto pela moderação" : PROJECT_STATUS_LABELS[row.status as keyof typeof PROJECT_STATUS_LABELS];
}

function Actions({ row, onDone }: { row: TargetRow; onDone: (message: string) => void }) {
  const props = { targetType: row.targetType, targetId: row.targetId, targetName: row.name, onDone };
  return (
    <div className="flex flex-wrap gap-2">
      {row.hidden ? <ModerationDialog kind="restore" {...props} /> : <ModerationDialog kind="hide" {...props} />}
      {row.pendingCount > 0 && <ModerationDialog kind="dismiss" {...props} />}
    </div>
  );
}

function Heading({ row }: { row: TargetRow }) {
  return (
    <div className="min-w-0">
      <p className="tabular-nums text-xs uppercase tracking-wide text-stone-500">{TYPE_LABELS[row.targetType]}</p>
      <h3 className="font-heading text-base font-semibold text-stone-900">{row.name}</h3>
      {row.targetType === "OPPORTUNITY" && <p className="text-sm text-stone-600">{row.projectName}</p>}
      <p className="mt-1 text-sm text-stone-700">
        <span className="tabular-nums text-xs">Estado:</span> {statusLabel(row)}
      </p>
      {/* O admin vê o que julga antes de ocultar ou restaurar, inclusive o que já está oculto. */}
      <Link
        href={`/admin/conteudo/${CONTENT_SEGMENTS[row.targetType]}/${row.targetId}`}
        aria-label={`Ver conteúdo: ${row.name}`}
        className="mt-1 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        Ver conteúdo
      </Link>
    </div>
  );
}

/** Fila de denúncias e resultados da busca. Avisos de sucesso vão para uma região `status` que recebe o foco. */
export function AdminQueue({ queue, query, results }: { queue: QueueItem[]; query: string; results: TargetRow[] }) {
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  function handleDone(message: string) {
    setNotice(message);
    // O botão que abriu o diálogo pode sair da lista; o foco vai para o aviso.
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  return (
    <div className="space-y-10">
      <div role="status" aria-live="polite">
        {notice && (
          <p
            ref={noticeRef}
            tabIndex={-1}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 outline-none"
          >
            {notice}
          </p>
        )}
      </div>

      <section aria-labelledby="fila-titulo" className="space-y-4">
        <h2 id="fila-titulo" className="font-heading text-xl font-semibold tracking-tight text-stone-900">
          Fila de denúncias
        </h2>
        {queue.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
            Nenhuma denúncia pendente.
          </p>
        ) : (
          <ul className="space-y-3">
            {queue.map((item) => (
              <li
                key={`${item.targetType}:${item.targetId}`}
                className="rounded-lg border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <Heading row={item} />
                  <p className="tabular-nums text-sm text-stone-900">
                    {item.pendingCount} {item.pendingCount === 1 ? "denúncia" : "denúncias"}
                  </p>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {item.reasons.map((r) => (
                    <li key={r.code} className="rounded-md bg-stone-100 px-2 py-0.5 tabular-nums text-xs text-stone-700">
                      {REPORT_REASON_LABELS[r.code]} ({r.count})
                    </li>
                  ))}
                </ul>
                {item.descriptions.length > 0 && (
                  <ul className="mt-3 space-y-1 border-l-2 border-stone-200 pl-3 text-sm text-stone-600">
                    {item.descriptions.map((d, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, só de exibição, que não muda de ordem.
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <Actions row={item} onDone={handleDone} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="busca-titulo" className="space-y-4">
        <h2 id="busca-titulo" className="font-heading text-xl font-semibold tracking-tight text-stone-900">
          Buscar projeto ou processo
        </h2>
        <search>
          <form method="get" action="/admin" className="flex flex-wrap gap-2">
            <label htmlFor="admin-q" className="sr-only">
              Nome do projeto ou do processo
            </label>
            <input
              id="admin-q"
              name="q"
              type="search"
              defaultValue={query}
              maxLength={100}
              placeholder="Nome do projeto ou do processo"
              className="h-9 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-500"
            />
            <button
              type="submit"
              className="h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              Buscar
            </button>
          </form>
        </search>
        {query &&
          (results.length === 0 ? (
            <p className="text-sm text-stone-600">Nada encontrado para essa busca.</p>
          ) : (
            <ul className="space-y-3">
              {results.map((row) => (
                <li
                  key={`${row.targetType}:${row.targetId}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white p-4"
                >
                  <Heading row={row} />
                  <Actions row={row} onDone={handleDone} />
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
