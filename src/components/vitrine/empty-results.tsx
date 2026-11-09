import Link from "next/link";
import { Button } from "@/components/ui/button";

const box = "rounded-2xl bg-surface px-6 py-9 text-center shadow-card";
const title = "text-[1.3rem] font-bold";
const text = "mx-auto mt-1.5 mb-4 max-w-prose text-ink-2";

/**
 * - `none`: não há nenhum processo aberto no sistema;
 * - `tab`: a aba escolhida está vazia, mas há processos nas outras;
 * - `filtered`: nada combina com a busca e os filtros.
 */
export function EmptyResults({ kind, allHref }: { kind: "none" | "tab" | "filtered"; allHref?: string }) {
  if (kind === "none") {
    return (
      <div className={box}>
        <h2 className={title}>Nenhum processo aberto agora</h2>
        <p className={text}>
          Quando um projeto da UNIFEI abrir inscrições, ele aparece aqui. Faz parte de um projeto? Publique o primeiro
          processo.
        </p>
        <Button asChild>
          <Link href="/publicar">Publicar processo</Link>
        </Button>
      </div>
    );
  }
  if (kind === "tab") {
    return (
      <div className={box}>
        <h2 className={title}>Nenhum processo nesta aba</h2>
        <p className={text}>Com a busca e os filtros atuais, nenhum processo está nessa situação.</p>
        <Button asChild variant="outline">
          <Link href={allHref ?? "/"} prefetch={false}>
            Ver todos os abertos
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className={box}>
      <h2 className={title}>Nenhum processo com esses filtros</h2>
      <p className={text}>Tente tirar um filtro ou buscar por outra palavra.</p>
      {/* <a> comum: recarrega e zera os campos não controlados do formulário. */}
      <Button asChild variant="ink">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarregar é o objetivo (ver acima). */}
        <a href="/">Limpar filtros e busca</a>
      </Button>
    </div>
  );
}
