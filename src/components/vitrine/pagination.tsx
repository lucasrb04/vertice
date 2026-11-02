import Link from "next/link";
import { vitrineHref, type VitrineParams } from "@/lib/public/search-params";
import { cn } from "@/lib/utils";

const linkClass =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

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

export function Pagination({
  params,
  page,
  pageCount,
}: {
  params: VitrineParams;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => vitrineHref(params, { page: p });
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={cn(linkClass, "border-stone-200 text-stone-700 hover:border-stone-400")}>
          Anterior
        </Link>
      ) : null}
      {pageList(page, pageCount).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 font-mono text-stone-500">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === page ? "page" : undefined}
            aria-label={`Página ${n}`}
            className={cn(
              linkClass,
              n === page
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 text-stone-700 hover:border-stone-400",
            )}
          >
            {n}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={cn(linkClass, "border-stone-200 text-stone-700 hover:border-stone-400")}>
          Próxima
        </Link>
      ) : null}
    </nav>
  );
}
