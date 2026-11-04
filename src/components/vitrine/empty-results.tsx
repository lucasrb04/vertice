// <a> comum no link de limpar: recarrega e zera os campos não controlados do formulário.
export function EmptyResults({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-5 py-8">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-stone-900">Nenhum processo encontrado</h2>
      <p className="mt-1 max-w-prose text-sm text-stone-600">
        {filtered
          ? "Nenhum processo combina com a busca e os filtros escolhidos. Tente termos mais gerais ou remova algum filtro."
          : "Quando um projeto da UNIFEI abrir inscrições, ele aparece aqui."}
      </p>
      {filtered && (
        <a href="/processos" className="mt-4 inline-block text-sm font-medium text-brand underline underline-offset-4">
          Limpar busca e filtros
        </a>
      )}
    </div>
  );
}
