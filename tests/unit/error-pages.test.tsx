import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";

const error = Object.assign(new Error("segredo-do-banco"), { digest: "abc" });

describe("páginas de erro", () => {
  it("error.tsx mostra mensagem em pt-BR sem detalhes do erro", () => {
    const out = renderToStaticMarkup(<ErrorPage error={error} reset={() => {}} />);
    expect(out).toContain("Tentar de novo");
    expect(out).not.toContain("segredo-do-banco");
  });
  it("global-error.tsx define html/body e não vaza detalhes", () => {
    const out = renderToStaticMarkup(<GlobalError error={error} reset={() => {}} />);
    expect(out).toContain("<html");
    expect(out).toContain("<body");
    expect(out).toContain("Tentar de novo");
    expect(out).not.toContain("segredo-do-banco");
  });
});
