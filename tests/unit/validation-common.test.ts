import { describe, expect, it } from "vitest";
import {
  dayString,
  HTTPS_ONLY,
  httpsUrl,
  optionalHttpsUrl,
  parseBrlToCents,
  restrictedMarkdown,
} from "@/lib/validation/common";

describe("httpsUrl", () => {
  it("aceita e apara link com espaços e protocolo em maiúsculas", () => {
    expect(httpsUrl(500).parse("  HTTPS://unifei.edu.br/edital.pdf ")).toBe("HTTPS://unifei.edu.br/edital.pdf");
  });
  it("recusa protocolos que não são https", () => {
    for (const bad of [
      "http://unifei.edu.br",
      "javascript:alert(1)",
      "data:text/html,x",
      "unifei.edu.br",
      "ftp://x",
      "https:/admin",
      "https:admin",
    ])
      expect(httpsUrl(500).safeParse(bad).success).toBe(false);
  });
  it("usa a mensagem fixa", () => {
    const r = httpsUrl(500).safeParse("http://x.com");
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toContain(HTTPS_ONLY);
  });
  it("respeita o tamanho máximo", () => {
    expect(httpsUrl(20).safeParse("https://unifei.edu.br/muito-longo").success).toBe(false);
  });
});

describe("optionalHttpsUrl", () => {
  it("vazio ou ausente vira null", () => {
    const s = optionalHttpsUrl(255);
    expect(s.parse("")).toBeNull();
    expect(s.parse("   ")).toBeNull();
    expect(s.parse(undefined)).toBeNull();
    expect(s.parse(null)).toBeNull();
  });
  it("valida quando preenchido", () => {
    expect(optionalHttpsUrl(255).safeParse("http://x.com").success).toBe(false);
    expect(optionalHttpsUrl(255).parse(" https://x.com ")).toBe("https://x.com");
  });
});

describe("restrictedMarkdown", () => {
  const md = restrictedMarkdown(5000);
  it("aceita formatação e links https", () => {
    expect(md.safeParse("**negrito** e [edital](https://unifei.edu.br)").success).toBe(true);
  });
  it("recusa HTML", () => {
    expect(md.safeParse("<script>x</script>").success).toBe(false);
  });
  it("recusa links com destino não https", () => {
    expect(md.safeParse("[x](javascript:alert(1))").success).toBe(false);
    expect(md.safeParse("![x](http://a.com/i.png)").success).toBe(false);
  });
  it("aceita sinais de menor e maior soltos", () => {
    expect(md.safeParse("2 < 3 e 5 > 4").success).toBe(true);
  });
  it("respeita o máximo", () => {
    expect(restrictedMarkdown(5).safeParse("123456").success).toBe(false);
  });
});

describe("parseBrlToCents", () => {
  it("converte formatos válidos", () => {
    expect(parseBrlToCents("700")).toBe(70000);
    expect(parseBrlToCents("700,5")).toBe(70050);
    expect(parseBrlToCents("1.200,00")).toBe(120000);
    expect(parseBrlToCents("1200.50")).toBe(120050);
    expect(parseBrlToCents("1.200")).toBe(120000);
  });
  it("recusa valores inválidos", () => {
    for (const bad of ["0", "abc", "-5", "1,234", ""]) expect(parseBrlToCents(bad)).toBeNull();
  });
});

describe("dayString", () => {
  it("valida data de calendário", () => {
    expect(dayString.safeParse("2026-10-27").success).toBe(true);
    expect(dayString.safeParse("2026-02-30").success).toBe(false);
    expect(dayString.safeParse("27/10/2026").success).toBe(false);
  });
});

describe("fix final: R$ e definições de link", () => {
  it("parseBrlToCents aceita prefixo R$", () => {
    expect(parseBrlToCents("R$ 700,00")).toBe(70000);
    expect(parseBrlToCents("R$700")).toBe(70000);
    expect(parseBrlToCents("R$")).toBeNull();
  });
  it("restrictedMarkdown valida definições de link por referência", () => {
    const md = restrictedMarkdown(500);
    expect(md.safeParse("texto [x]\n\n[x]: javascript:alert(1)").success).toBe(false);
    expect(md.safeParse("texto [x]\n\n[x]: https://unifei.edu.br").success).toBe(true);
  });
});
