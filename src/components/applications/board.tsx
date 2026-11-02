"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Board, BoardCard } from "@/lib/applications/board";
import { APPLICATION_STATUS_LABELS } from "@/lib/applications/labels";
import { formatDay } from "@/lib/time";
import { MOVE_ITEMS_MAX } from "@/lib/validation/application";
import { MoveDialog, type MoveTarget } from "./move-dialog";

function moveSummary({ moved, skipped }: { moved: number; skipped: number }): string {
  const done =
    moved === 0 ? "Nenhum candidato movido." : moved === 1 ? "1 candidato movido." : `${moved} candidatos movidos.`;
  if (skipped === 0) return done;
  const rest = skipped === 1 ? "1 não mudou" : `${skipped} não mudaram`;
  return `${done} ${rest}: já estava na etapa ou outra pessoa moveu antes.`;
}

function CandidateCard({
  card,
  question,
  canMove,
  selected,
  onSelect,
  onMove,
}: {
  card: BoardCard;
  question: string | null;
  canMove: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onMove: (opener: HTMLElement) => void;
}) {
  const details = [card.courseName, card.currentSemester ? `${card.currentSemester}º período` : null].filter(Boolean);
  const showControls = canMove && !card.isOwn;

  return (
    <li className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-start gap-2.5">
        {showControls && (
          <Checkbox
            aria-label={`Selecionar ${card.name}`}
            className="mt-0.5"
            checked={selected}
            onCheckedChange={(checked) => onSelect(checked === true)}
          />
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium [overflow-wrap:anywhere] text-stone-900">{card.name}</p>
          {details.length > 0 && <p className="text-sm [overflow-wrap:anywhere] text-stone-600">{details.join(" · ")}</p>}
          <p className="font-mono text-xs text-stone-500">{formatDay(card.appliedAt)}</p>
          {card.isOwn && <p className="text-xs font-medium text-stone-600">Sua candidatura</p>}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer rounded-sm text-brand select-none">
          Abrir<span className="sr-only"> {card.name}</span>
        </summary>
        <dl className="mt-2 space-y-2 [overflow-wrap:anywhere]">
          <div>
            <dt className="text-xs text-stone-500">E-mail</dt>
            <dd>
              <a href={`mailto:${card.email}`} className="text-stone-800 underline underline-offset-4">
                {card.email}
              </a>
            </dd>
          </div>
          {card.profileLink && (
            <div>
              <dt className="text-xs text-stone-500">Link</dt>
              <dd>
                <a
                  href={card.profileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-800 underline underline-offset-4"
                >
                  {card.profileLink}
                </a>
              </dd>
            </div>
          )}
          {card.answerText && (
            <div>
              <dt className="text-xs text-stone-500">{question ?? "Resposta"}</dt>
              <dd className="whitespace-pre-line text-stone-800">{card.answerText}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-stone-500">Histórico</dt>
            <dd>
              <ol className="mt-1 space-y-1.5 border-l-2 border-stone-200 pl-3">
                {card.history.map((h, i) => (
                  <li key={`${h.createdAt.toISOString()}-${i}`}>
                    <p className="font-mono text-xs text-stone-500">
                      {formatDay(h.createdAt)} · {APPLICATION_STATUS_LABELS[h.toStatus]}
                    </p>
                    {h.message && <p className="whitespace-pre-line text-stone-800">{h.message}</p>}
                  </li>
                ))}
              </ol>
            </dd>
          </div>
        </dl>
      </details>
      {showControls && (
        <Button type="button" variant="outline" size="sm" onClick={(e) => onMove(e.currentTarget)}>
          Mover para<span className="sr-only"> ({card.name})</span>
        </Button>
      )}
    </li>
  );
}

/** Quadro de candidatos: uma coluna por etapa no desktop, lista no celular. Sem arrastar (spec §8). */
export function ApplicationBoard({ board }: { board: Board }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<{ key: number; target: MoveTarget; open: boolean } | null>(null);
  const [result, setResult] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const resultRef = useRef<HTMLParagraphElement | null>(null);
  const justMoved = useRef(false);

  const cards = board.columns.flatMap((c) => c.cards);
  const selectedCards = cards.filter((c) => selected.has(c.id));
  const overLimit = selectedCards.length > MOVE_ITEMS_MAX;

  function openDialog(target: Omit<MoveTarget, "items"> & { cards: BoardCard[] }, from: HTMLElement) {
    opener.current = from;
    justMoved.current = false;
    setDialog((prev) => ({
      key: (prev?.key ?? 0) + 1,
      open: true,
      target: {
        summary: target.summary,
        items: target.cards.map((c) => ({ applicationId: c.id, fromStatus: c.status })),
      },
    }));
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleMoved(res: { moved: number; skipped: number }) {
    const done = new Set(dialog?.target.items.map((i) => i.applicationId));
    setSelected((prev) => new Set([...prev].filter((id) => !done.has(id))));
    setResult(moveSummary(res));
    justMoved.current = true;
    setDialog((prev) => prev && { ...prev, open: false });
  }

  return (
    <div className="mt-6 space-y-4">
      {board.canMove && (
        <div
          role="group"
          aria-label="Candidatos selecionados"
          className="sticky top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-stone-200 bg-white px-3 py-2"
        >
          <p aria-live="polite" className="font-mono text-xs text-stone-600">
            {selectedCards.length === 1 ? "1 selecionado" : `${selectedCards.length} selecionados`}
            {overLimit && ` · até ${MOVE_ITEMS_MAX} de cada vez`}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={selectedCards.length === 0 || overLimit}
            onClick={(e) =>
              openDialog(
                {
                  cards: selectedCards,
                  summary:
                    selectedCards.length === 1 ? selectedCards[0]!.name : `${selectedCards.length} candidatos selecionados`,
                },
                e.currentTarget,
              )
            }
          >
            Mover selecionados
          </Button>
          {selectedCards.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          )}
        </div>
      )}
      <p ref={resultRef} role="status" tabIndex={-1} className="text-sm text-stone-700 outline-none empty:hidden">
        {result}
      </p>

      {/* `relative`: sem ele, os textos `sr-only` dos cards escapam da rolagem e alargam a página. */}
      <div className="relative grid gap-6 md:flex md:gap-3 md:overflow-x-auto md:pb-2">
        {board.columns.map((column) => (
          <section
            key={column.status}
            aria-labelledby={`etapa-${column.status}`}
            className="min-w-0 md:min-w-60 md:flex-1"
          >
            <h2 id={`etapa-${column.status}`} className="flex items-baseline gap-2 font-medium text-stone-900">
              {APPLICATION_STATUS_LABELS[column.status]}
              <span className="font-mono text-sm font-normal text-stone-500">{column.cards.length}</span>
            </h2>
            {column.cards.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">Nenhum candidato.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {column.cards.map((card) => (
                  <CandidateCard
                    key={card.id}
                    card={card}
                    question={board.opportunity.customQuestion}
                    canMove={board.canMove}
                    selected={selected.has(card.id)}
                    onSelect={(checked) => toggle(card.id, checked)}
                    onMove={(from) => openDialog({ cards: [card], summary: card.name }, from)}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {dialog && (
        <MoveDialog
          key={dialog.key}
          projectId={board.project.id}
          opportunityId={board.opportunity.id}
          target={dialog.target}
          open={dialog.open}
          onOpenChange={(open) => setDialog((prev) => prev && { ...prev, open })}
          onMoved={handleMoved}
          onCloseAutoFocus={(e) => {
            // Depois de mover, o card troca de coluna: o foco vai para o resultado.
            e.preventDefault();
            (justMoved.current ? resultRef.current : opener.current)?.focus();
          }}
        />
      )}
    </div>
  );
}
