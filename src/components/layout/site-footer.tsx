import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-stone-600 sm:flex-row sm:justify-between">
        <p>Vértice — vagas e projetos da UNIFEI, Campus Itajubá.</p>
        <Link href="/privacidade" className="text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline">
          Política de Privacidade
        </Link>
      </div>
    </footer>
  );
}
