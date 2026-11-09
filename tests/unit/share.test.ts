import { describe, expect, it } from "vitest";
import { processPublicUrl, shareMessage } from "@/lib/projects/share";

describe("processPublicUrl", () => {
  it("monta a URL pública do processo a partir da URL do app", () => {
    expect(processPublicUrl("https://verticehub.online", "bolsista-visao")).toBe(
      "https://verticehub.online/processo/bolsista-visao",
    );
  });

  it("não duplica a barra quando a URL do app termina com /", () => {
    expect(processPublicUrl("https://verticehub.online/", "x")).toBe("https://verticehub.online/processo/x");
  });
});

describe("shareMessage", () => {
  // 23h59 de 20/11 em Brasília.
  const deadlineAt = new Date("2026-11-21T02:59:59.000Z");

  it("texto pronto para colar: processo, projeto, prazo com hora e fuso e o link", () => {
    expect(
      shareMessage({
        title: "Bolsista de visão computacional",
        projectName: "Laboratório de Robótica",
        deadlineAt,
        url: "https://verticehub.online/processo/bolsista-visao",
      }),
    ).toBe(
      [
        "Processo seletivo aberto: Bolsista de visão computacional (Laboratório de Robótica).",
        "Inscrições até 20/11/2026, 23h59 (horário de Brasília).",
        "Detalhes e inscrição: https://verticehub.online/processo/bolsista-visao",
      ].join("\n"),
    );
  });
});
