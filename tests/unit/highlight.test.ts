import { describe, expect, it } from "vitest";
import { highlightParts } from "@/lib/public/highlight";

describe("highlightParts", () => {
  it("ignora acento e caixa e preserva o texto original", () => {
    expect(highlightParts("Robôs agrícolas", "robo")).toEqual([
      { text: "Robô", hit: true },
      { text: "s agrícolas", hit: false },
    ]);
  });

  it("escapa caracteres de expressão regular", () => {
    expect(highlightParts("C++ e Python", "c++")).toEqual([
      { text: "C++", hit: true },
      { text: " e Python", hit: false },
    ]);
    expect(highlightParts("abc", "(")).toEqual([{ text: "abc", hit: false }]);
  });

  it("vários termos e termos de uma letra ignorados", () => {
    expect(highlightParts("Visão computacional e robótica", "robotica e visao")).toEqual([
      { text: "Visão", hit: true },
      { text: " computacional e ", hit: false },
      { text: "robótica", hit: true },
    ]);
  });

  it("sem busca, um só pedaço", () => {
    expect(highlightParts("Título", "")).toEqual([{ text: "Título", hit: false }]);
  });
});
