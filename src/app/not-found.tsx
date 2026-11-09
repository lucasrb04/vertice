import Link from "next/link";

// Única página de 404: rota inexistente e recurso sem permissão (ex.: /admin para não-admin)
// precisam ser indistinguíveis.
export default function NotFound() {
  return (
    <section className="px-4 pt-10 sm:pt-16">
      <div className="mx-auto max-w-xl rounded-[20px] bg-surface p-7 shadow-card sm:p-9">
        <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">Página não encontrada</h1>
        <p className="mt-3 text-ink-2">O endereço que você acessou não existe ou não está disponível.</p>
        <Link
          href="/"
          className="mt-6 inline-block font-semibold text-ink underline underline-offset-4 hover:decoration-2"
        >
          Voltar para o início
        </Link>
      </div>
    </section>
  );
}
