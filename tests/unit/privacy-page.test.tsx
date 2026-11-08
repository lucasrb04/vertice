import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacidadePage, { metadata } from "@/app/(public)/privacidade/page";
import { SiteFooter } from "@/components/layout/site-footer";

describe("/privacidade", () => {
  const out = renderToStaticMarkup(<PrivacidadePage />);

  it("tem título próprio e um único h1", () => {
    expect(metadata.title).toBe("Política de Privacidade — Vértice");
    expect(out.match(/<h1/g)).toHaveLength(1);
  });

  it("identifica o controlador, o contato e os direitos do titular (LGPD art. 9º e 18)", () => {
    expect(out).toContain("Lucas Ribeiro Barbosa");
    expect(out).toContain('href="mailto:privacidade@verticehub.online"');
    expect(out).toContain("Seus direitos");
  });

  it("informa o registro de acessos e por quanto tempo fica guardado", () => {
    expect(out).toContain("registro de acessos");
    expect(out).toContain("14 dias");
  });

  it("nomeia os operadores que recebem dados", () => {
    for (const operador of ["Google", "Oracle Cloud", "Resend", "Cloudflare"]) expect(out).toContain(operador);
  });
});

describe("rodapé", () => {
  it("leva à política de privacidade", () => {
    expect(renderToStaticMarkup(<SiteFooter />)).toContain('href="/privacidade"');
  });
});
