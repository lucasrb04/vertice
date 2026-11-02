import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/applications/labels";

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
});
