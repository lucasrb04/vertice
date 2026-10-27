import { describe, it, expect } from "vitest";
import { normalizeTagSlug } from "@/lib/search/tags";

describe("normalizeTagSlug", () => {
  it.each([
    ["Visão Computacional ", "visao-computacional"],
    ["C++", "c++"],
    ["C#", "c#"],
    ["React.js", "react.js"],
    ["react   js", "react-js"],
    ["  Gestão de Pessoas", "gestao-de-pessoas"],
    ["Impressão 3D", "impressao-3d"],
    ["--Python--", "python"],
    ["Design de PCB", "design-de-pcb"],
    ["!!!", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTagSlug(input)).toBe(expected);
  });

  it("limita a 64 caracteres sem terminar em hífen", () => {
    const out = normalizeTagSlug("a ".repeat(50));
    expect(out.length).toBeLessThanOrEqual(64);
    expect(out.endsWith("-")).toBe(false);
  });
});
