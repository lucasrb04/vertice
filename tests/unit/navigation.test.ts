import { describe, expect, it } from "vitest";
import { isNavActive } from "@/lib/navigation";

describe("isNavActive", () => {
  it("Processos fica ativo na lista e nas páginas de processo", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/", "/processo/x")).toBe(true);
    expect(isNavActive("/", "/processos")).toBe(true);
    expect(isNavActive("/", "/painel")).toBe(false);
  });

  it("os demais valem pelo segmento inteiro", () => {
    expect(isNavActive("/painel", "/painel")).toBe(true);
    expect(isNavActive("/painel", "/painelx")).toBe(false);
    expect(isNavActive("/publicar", "/publicar")).toBe(true);
    expect(isNavActive("/minhas-candidaturas", "/minhas-candidaturas")).toBe(true);
  });
});
