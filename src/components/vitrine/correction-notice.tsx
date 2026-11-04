import Link from "next/link";
import { type VitrineParams, vitrineHref } from "@/lib/public/search-params";

/**
 * Faixa de correção da busca (spec §5.5). Links comuns: funciona sem JavaScript. O texto corrigido mantém
 * as palavras do usuário onde nada mudou e a forma do vocabulário (sem acento) onde mudou.
 */
export function CorrectionNotice({
  params,
  correction,
}: {
  params: VitrineParams;
  correction: { original: string; corrected: string };
}) {
  return (
    <p role="status" className="mb-4 text-sm text-stone-700">
      Mostrando resultados para <strong className="font-semibold text-stone-900">{correction.corrected}</strong>
      <span aria-hidden> · </span>
      <Link
        href={vitrineHref(params, { exact: true })}
        prefetch={false}
        className="font-medium text-brand underline underline-offset-4"
      >
        buscar exatamente <strong className="font-semibold">{correction.original}</strong>
      </Link>
    </p>
  );
}
