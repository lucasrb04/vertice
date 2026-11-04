"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Nenhum detalhe do erro vai para a tela: só o log (o `digest` casa com o log do servidor).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="bg-stone-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-md border border-stone-200 bg-white p-8">
        <p className="font-mono text-xs tracking-wide text-stone-500 uppercase">Erro</p>
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-stone-900">Algo deu errado</h1>
        <p className="mt-3 text-stone-600">Não foi possível carregar esta página agora. Tente de novo em instantes.</p>
        <Button type="button" variant="outline" className="mt-6" onClick={reset}>
          Tentar de novo
        </Button>
      </div>
    </section>
  );
}
