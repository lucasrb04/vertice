"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Nenhum detalhe do erro vai para a tela: só o log (o `digest` casa com o log do servidor).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="px-4 pt-10 sm:pt-16">
      <div className="mx-auto max-w-xl rounded-[20px] bg-surface p-7 shadow-card sm:p-9">
        <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">Algo deu errado</h1>
        <p className="mt-3 text-ink-2">Não foi possível carregar esta página agora. Tente de novo em instantes.</p>
        <Button type="button" variant="outline" className="mt-6" onClick={reset}>
          Tentar de novo
        </Button>
      </div>
    </section>
  );
}
