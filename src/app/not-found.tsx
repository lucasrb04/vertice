import Link from "next/link";

// Única página de 404: rota inexistente e recurso sem permissão (ex.: /admin para não-admin)
// precisam ser indistinguíveis.
export default function NotFound() {
  return (
    <section className="bg-stone-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-md border border-stone-200 bg-white p-8">
        <p className="tabular-nums text-xs tracking-wide text-stone-500 uppercase">Erro 404</p>
        <h1 className="mt-2 text-[1.75rem] leading-tight font-extrabold text-ink">Página não encontrada</h1>
        <p className="mt-3 text-stone-600">O endereço que você acessou não existe ou não está disponível.</p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-semibold text-ink underline underline-offset-4 hover:decoration-2"
        >
          Voltar para o início
        </Link>
      </div>
    </section>
  );
}
