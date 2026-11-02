import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeMarkdown } from "@/components/vitrine/safe-markdown";

const html = (source: string) => renderToStaticMarkup(<SafeMarkdown source={source} />);

describe("SafeMarkdown", () => {
  it("renderiza negrito, itálico e listas", () => {
    const out = html("**forte** e *leve*\n\n- um\n- dois\n\n1. três");
    expect(out).toContain("<strong>forte</strong>");
    expect(out).toContain("<em>leve</em>");
    expect(out).toContain("<ul");
    expect(out).toContain("<li>um</li>");
    expect(out).toContain("<ol");
  });

  it("link https abre em nova aba com rel seguro", () => {
    const out = html("[edital](https://unifei.edu.br/a.pdf)");
    expect(out).toContain('href="https://unifei.edu.br/a.pdf"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="nofollow noopener noreferrer"');
  });

  it.each([
    ["javascript", "[x](javascript:alert(1))"],
    ["http", "[x](http://a.com)"],
    ["relativo", "[x](/admin)"],
    ["protocolo implícito", "[x](//a.com)"],
    ["data", "[x](data:text/html,oi)"],
    ["referência javascript", "[x]\n\n[x]: javascript:alert(1)"],
    ["maiúsculas", "[x](JaVaScRiPt:alert(1))"],
  ])("link %s vira texto, sem href", (_, source) => {
    const out = html(source);
    expect(out).not.toContain("href");
    expect(out).not.toContain("<a");
    expect(out).toContain("x");
  });

  it("definição de referência sozinha não gera link", () => {
    expect(html("[x]: javascript:alert(1)")).not.toContain("href");
  });

  it("HTML cru não gera elemento", () => {
    const out = html('<script>alert(1)</script>\n\ntexto <b onclick="x()">oi</b>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<b");
  });

  it("imagem não gera elemento e mantém o texto alternativo", () => {
    const out = html("![foto do lab](https://a.com/x.png)");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("a.com");
    expect(out).toContain("foto do lab");
  });

  it("elementos fora da lista perdem a tag e mantêm o texto", () => {
    const out = html("# Título\n\n> citação\n\n`código`\n\n---");
    for (const tag of ["<h1", "<blockquote", "<code", "<hr"]) expect(out).not.toContain(tag);
    for (const text of ["Título", "citação", "código"]) expect(out).toContain(text);
  });
});
