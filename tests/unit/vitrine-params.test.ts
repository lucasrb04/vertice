import { describe, expect, it } from "vitest";
import { parseVitrineParams, vitrineHref } from "@/lib/public/search-params";

describe("parseVitrineParams", () => {
  it("padrões", () => {
    expect(parseVitrineParams({})).toEqual({
      q: "", categories: [], scholarship: null, course: null, tags: [], includeClosed: false, sort: "recent", page: 1, exact: false,
    });
  });
  it("sort padrão depende de q", () => {
    expect(parseVitrineParams({ q: "robô" }).sort).toBe("relevance");
    expect(parseVitrineParams({ q: "robô", sort: "deadline" }).sort).toBe("deadline");
    expect(parseVitrineParams({ sort: "xx" }).sort).toBe("recent");
  });
  it("category repetida e inválida", () => {
    expect(parseVitrineParams({ category: ["PET", "NOPE", "EXTENSION", "PET"] }).categories).toEqual(["PET", "EXTENSION"]);
    expect(parseVitrineParams({ category: "NOPE" }).categories).toEqual([]);
  });
  it("page inválida", () => {
    expect(parseVitrineParams({ page: "abc" }).page).toBe(1);
    expect(parseVitrineParams({ page: "-1" }).page).toBe(1);
    expect(parseVitrineParams({ page: "0" }).page).toBe(1);
    expect(parseVitrineParams({ page: "3" }).page).toBe(3);
  });
  it("q aparado e cortado em 100", () => {
    expect(parseVitrineParams({ q: "  abc  " }).q).toBe("abc");
    expect(parseVitrineParams({ q: "x".repeat(150) }).q).toHaveLength(100);
  });
  it("tags separadas por vírgula", () => {
    expect(parseVitrineParams({ tags: "python,,cad" }).tags).toEqual(["python", "cad"]);
  });
  it("tags repetidas (checkboxes) e mistas com vírgula", () => {
    expect(parseVitrineParams({ tags: ["python", "cad"] }).tags).toEqual(["python", "cad"]);
    expect(parseVitrineParams({ tags: ["python,cad", "Python", "ia"] }).tags).toEqual(["python", "cad", "ia"]);
  });
  it("scholarship, encerrados e course", () => {
    expect(parseVitrineParams({ scholarship: "BOTH" }).scholarship).toBeNull();
    expect(parseVitrineParams({ scholarship: "PAID" }).scholarship).toBe("PAID");
    expect(parseVitrineParams({ encerrados: "1" }).includeClosed).toBe(true);
    expect(parseVitrineParams({ encerrados: "0" }).includeClosed).toBe(false);
    expect(parseVitrineParams({ corrigir: "0" }).exact).toBe(true);
    expect(parseVitrineParams({ corrigir: "1" }).exact).toBe(false);
    expect(parseVitrineParams({ course: " CCO " }).course).toBe("CCO");
  });
});

describe("byte nulo", () => {
  it("é removido de q, course e tags", () => {
    const p = parseVitrineParams({ q: "a\0b", course: "\0", tags: "\0,py\0thon" });
    expect(p.q).toBe("ab");
    expect(p.course).toBeNull();
    expect(p.tags).toEqual(["python"]);
    expect(parseVitrineParams({ q: "\0" }).q).toBe("");
    expect(parseVitrineParams({ tags: "\0" }).tags).toEqual([]);
  });
});

describe("vitrineHref", () => {
  const base = parseVitrineParams({});
  it("omite padrões", () => {
    expect(vitrineHref(base)).toBe("/processos");
    expect(vitrineHref(parseVitrineParams({ q: "ia" }))).toBe("/processos?q=ia");
  });
  it("mudar filtro volta à página 1; page explícito é mantido", () => {
    const p = parseVitrineParams({ page: "4", q: "ia" });
    expect(vitrineHref(p, { includeClosed: true })).toBe("/processos?q=ia&encerrados=1");
    expect(vitrineHref(p, { exact: true })).toBe("/processos?q=ia&corrigir=0");
    expect(vitrineHref(p, { page: 5 })).toBe("/processos?q=ia&page=5");
  });
  it("inclui sort fora do padrão e tags", () => {
    const p = parseVitrineParams({ tags: "python,cad", sort: "popular", category: "PET" });
    expect(vitrineHref(p)).toBe("/processos?category=PET&tags=python,cad&sort=popular");
  });
  it("round trip", () => {
    const p = parseVitrineParams({ q: "C++ 100%", category: ["PET", "EXTENSION"], scholarship: "PAID", course: "CCO", tags: "a,b", encerrados: "1", sort: "deadline" });
    const url = new URL("http://x" + vitrineHref(p));
    const raw: Record<string, string | string[]> = {};
    for (const k of new Set(url.searchParams.keys())) {
      const v = url.searchParams.getAll(k);
      raw[k] = v.length > 1 ? v : v[0];
    }
    expect(parseVitrineParams(raw)).toEqual(p);
  });
});
