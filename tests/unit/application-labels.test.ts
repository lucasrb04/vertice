import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  FINAL_STATUSES,
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
});
