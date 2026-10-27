import Link from "next/link";

// Única página de 404: rota inexistente e recurso sem permissão (ex.: /admin para não-admin)
// precisam ser indistinguíveis.
export default function NotFound() {
  return (
    <section className="bg-stone-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-md border border-stone-200 bg-white p-8">
        <p className="font-mono text-xs tracking-wide text-stone-500 uppercase">Erro 404</p>
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-stone-900">
          Página não encontrada
        </h1>
        <p className="mt-3 text-stone-600">
          O endereço que você acessou não existe ou não está disponível.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Voltar para o início
        </Link>
      </div>
    </section>
  );
}
