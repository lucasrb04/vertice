import { describe, expect, it } from "vitest";
import { stripDiminutive } from "@/lib/search/corrector";

describe("stripDiminutive", () => {
  it("-inha e -inho restauram a vogal, a do gênero primeiro", () => {
    expect(stripDiminutive("casinha")).toEqual(["casa", "caso"]);
    expect(stripDiminutive("livrinho")).toEqual(["livro", "livra"]);
  });

  it("-zinho e -zinha removem o sufixo inteiro antes de tentar -inho", () => {
    expect(stripDiminutive("cafezinho")[0]).toBe("cafe");
    expect(stripDiminutive("florzinha")[0]).toBe("flor");
  });

  it("plurais: singular primeiro, depois a forma plural", () => {
    expect(stripDiminutive("casinhas")).toEqual(["casa", "caso", "casas", "casos"]);
    expect(stripDiminutive("cafezinhos")[0]).toBe("cafe");
    expect(stripDiminutive("cafezinhos")).toContain("cafes");
    expect(stripDiminutive("florzinhas")[0]).toBe("flor");
  });

  it("aceita acento e maiúsculas", () => {
    expect(stripDiminutive("Pãozinho")[0]).toBe("pao");
  });

  it("não inventa radical curto nem mexe em palavra sem sufixo", () => {
    expect(stripDiminutive("minha")).toEqual([]);
    expect(stripDiminutive("linha")).toEqual([]);
    expect(stripDiminutive("casa")).toEqual([]);
    expect(stripDiminutive("python")).toEqual([]);
  });
});
