"use client";

import { useEffect } from "react";

// Substitui o layout raiz: define html/body e não depende de fontes nem de componentes do app.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#fafaf9", color: "#1c1917", fontFamily: "system-ui, sans-serif" }}>
        <section style={{ padding: "4rem 1rem" }}>
          <div
            style={{
              maxWidth: "36rem",
              margin: "0 auto",
              padding: "2rem",
              background: "#fff",
              border: "1px solid #e7e5e4",
              borderRadius: "0.375rem",
            }}
          >
            <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#78716c", textTransform: "uppercase" }}>
              Erro
            </p>
            <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.5rem" }}>Algo deu errado</h1>
            <p style={{ marginTop: "0.75rem", color: "#57534e" }}>
              Não foi possível carregar o Vértice agora. Tente de novo em instantes.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", border: "1px solid #e7e5e4", borderRadius: "0.375rem", background: "#fff", cursor: "pointer" }}
            >
              Tentar de novo
            </button>
          </div>
        </section>
      </body>
    </html>
  );
}
