import { describe, expect, it } from "vitest";
import { applySlugFromNext, loginContext } from "@/lib/auth/login-context";

describe("loginContext", () => {
  it("candidatura cita o título lido do banco", () => {
    expect(loginContext("/processo/ic-visao/candidatar", "IC em Visão Computacional")).toBe(
      "Entre para se candidatar a IC em Visão Computacional.",
    );
  });

  it("candidatura sem título (processo oculto ou inexistente) não tem frase", () => {
    expect(loginContext("/processo/ic-visao/candidatar", null)).toBeNull();
  });

  it("publicar, acompanhar e gerenciar têm frase própria", () => {
    expect(loginContext("/publicar", null)).toBe(
      "Entre para publicar o processo seletivo do seu projeto. Qualquer conta @unifei.edu.br publica, sem aprovação prévia.",
    );
    expect(loginContext("/minhas-candidaturas", null)).toBe("Entre para acompanhar suas candidaturas.");
    expect(loginContext("/projetos/8f6b1c2e-1d3a-4c5b-9e7f-0a1b2c3d4e5f/editar", null)).toBe(
      "Entre para gerenciar o seu projeto.",
    );
  });

  it("outros destinos, inclusive o padrão, não têm frase", () => {
    expect(loginContext("/painel", null)).toBeNull();
    expect(loginContext("/", null)).toBeNull();
    expect(loginContext("/publicarx", null)).toBeNull();
  });
});

describe("applySlugFromNext", () => {
  it("extrai o slug só do caminho de candidatura", () => {
    expect(applySlugFromNext("/processo/ic-visao/candidatar")).toBe("ic-visao");
    expect(applySlugFromNext("/processo/ic-visao/candidatar?x=1")).toBe("ic-visao");
    expect(applySlugFromNext("/processo/ic-visao")).toBeNull();
    expect(applySlugFromNext("/processo//candidatar")).toBeNull();
    expect(applySlugFromNext("/painel")).toBeNull();
  });
});
