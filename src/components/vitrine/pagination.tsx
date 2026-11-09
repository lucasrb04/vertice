import Link from "next/link";
import { type VitrineParams, vitrineHref } from "@/lib/public/search-params";
import { cn } from "@/lib/utils";

const linkClass =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border px-3.5 font-semibold tabular-nums";

function pageList(page: number, count: number): (number | null)[] {
  const keep = new Set([1, count, page - 1, page, page + 1]);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of [...keep].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)) {
    if (n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}

/** `prefetch={false}`: o prefetch de /?q= gastaria o limite de buscas do visitante. */
export function Pagination({ params, page, pageCount }: { params: VitrineParams; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => vitrineHref(params, { page: p });
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          prefetch={false}
          rel="prev"
          className={cn(linkClass, "border-line bg-surface text-ink hover:border-line-strong")}
        >
          Anterior
        </Link>
      ) : null}
      {pageList(page, pageCount).map((n, i) =>
        n === null ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, só de exibição, que não muda de ordem.
          <span key={`gap-${i}`} aria-hidden className="px-1 text-ink-3">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            prefetch={false}
            aria-current={n === page ? "page" : undefined}
            aria-label={`Página ${n}`}
            className={cn(
              linkClass,
              n === page ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-line-strong",
            )}
          >
            {n}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link
          href={href(page + 1)}
          prefetch={false}
          rel="next"
          className={cn(linkClass, "border-line bg-surface text-ink hover:border-line-strong")}
        >
          Próxima
        </Link>
      ) : null}
    </nav>
  );
}
