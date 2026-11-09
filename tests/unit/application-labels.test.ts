import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  FINAL_STATUSES,
  funnelSteps,
  REJECTION_SUGGESTION,
} from "@/lib/applications/labels";
import { MOVE_MESSAGE_MAX } from "@/lib/validation/application";

describe("rótulos de candidatura", () => {
  it("ordem e textos das etapas", () => {
    expect(APPLICATION_STATUSES.map((s) => APPLICATION_STATUS_LABELS[s])).toEqual([
      "Inscrito",
      "Em análise",
      "Entrevista",
      "Aprovado",
      "Não selecionado",
    ]);
  });

  it("o resultado sai em Aprovado e Não selecionado", () => {
    expect(FINAL_STATUSES).toEqual(["ACCEPTED", "REJECTED"]);
  });

  it("o texto sugerido para Não selecionado cabe na mensagem", () => {
    expect(REJECTION_SUGGESTION.length).toBeGreaterThan(0);
    expect(REJECTION_SUGGESTION.length).toBeLessThanOrEqual(MOVE_MESSAGE_MAX);
  });

  it("funil: etapas anteriores concluídas, a atual marcada e o resultado como último passo", () => {
    expect(funnelSteps("APPLIED")).toEqual([
      { label: "Inscrito", state: "current" },
      { label: "Em análise", state: "upcoming" },
      { label: "Entrevista", state: "upcoming" },
      { label: "Resultado", state: "upcoming" },
    ]);
    expect(funnelSteps("INTERVIEW").map((s) => s.state)).toEqual(["done", "done", "current", "upcoming"]);
    expect(funnelSteps("ACCEPTED").at(-1)).toEqual({ label: "Aprovado", state: "current" });
    expect(funnelSteps("REJECTED")).toEqual([
      { label: "Inscrito", state: "done" },
      { label: "Em análise", state: "done" },
      { label: "Entrevista", state: "done" },
      { label: "Não selecionado", state: "current" },
    ]);
  });
});
