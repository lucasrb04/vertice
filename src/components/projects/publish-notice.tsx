"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  kind: "published" | "updated";
  title: string;
  publicPath: string;
  publicUrl: string;
  shareText: string;
};

/**
 * Fim da jornada de quem publica: confirma o que aconteceu e entrega o que é preciso para divulgar
 * (link público e texto pronto). Na edição, só confirma e oferece o link.
 */
export function PublishNotice({ kind, title, publicPath, publicUrl, shareText }: Props) {
  const headingId = useId();
  const linkId = useId();
  const [feedback, setFeedback] = useState("");
  const published = kind === "published";

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(done);
    } catch {
      setFeedback("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <section aria-labelledby={headingId} className="mb-8 rounded-lg border border-stone-300 bg-white p-5">
      <h2 id={headingId} className="text-base font-semibold text-stone-900">
        {published ? "Processo publicado" : "Alterações salvas"}
      </h2>
      <p className="mt-1 text-sm [overflow-wrap:anywhere] text-stone-700">
        {published
          ? `“${title}” já aparece na vitrine. Divulgue o link para chegar a quem ainda não conhece o projeto.`
          : `As mudanças em “${title}” já estão na página pública.`}
      </p>

      <label htmlFor={linkId} className="mt-4 block text-sm font-medium text-stone-900">
        Link público
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          id={linkId}
          readOnly
          value={publicUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-stone-200 bg-stone-50 px-3 tabular-nums text-sm text-stone-800"
        />
        <Button type="button" variant="outline" onClick={() => copy(publicUrl, "Link copiado.")}>
          Copiar link
        </Button>
      </div>

      {published && (
        <div className="mt-4">
          <p className="text-sm font-medium text-stone-900">Texto para grupos e redes</p>
          <p className="mt-1 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm whitespace-pre-line [overflow-wrap:anywhere] text-stone-700">
            {shareText}
          </p>
          <Button type="button" variant="outline" className="mt-2" onClick={() => copy(shareText, "Texto copiado.")}>
            Copiar texto de divulgação
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={publicPath}
          className="text-sm font-semibold text-ink underline underline-offset-4 hover:decoration-2"
        >
          Ver como o aluno vê
        </Link>
        <p role="status" className="text-sm text-stone-700">
          {feedback}
        </p>
      </div>
    </section>
  );
}
