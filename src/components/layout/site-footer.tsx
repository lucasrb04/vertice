import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";
import { Shell } from "@/components/layout/shell";

export function SiteFooter() {
  return (
    <footer className="mt-16 pb-8">
      <Shell>
        <div className="flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5">
            <BrandMark className="size-5" />
            Vértice — vagas e projetos da UNIFEI, Campus Itajubá.
          </p>
          <Link
            href="/privacidade"
            className="font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Política de Privacidade
          </Link>
        </div>
      </Shell>
    </footer>
  );
}
