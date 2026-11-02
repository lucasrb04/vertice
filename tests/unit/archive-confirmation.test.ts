import { describe, expect, it } from "vitest";
import { archiveConfirmation } from "@/lib/projects/labels";

const BASE = "Arquivar encerra todos os processos do projeto e não pode ser desfeito nesta versão.";

describe("archiveConfirmation", () => {
  it("sem candidatos em andamento, só o aviso", () => {
    expect(archiveConfirmation(0)).toBe(BASE);
  });
  it("cita o número, no singular e no plural", () => {
    expect(archiveConfirmation(1)).toBe(`${BASE} Há 1 candidato ainda em andamento (Inscrito, Em análise ou Entrevista).`);
    expect(archiveConfirmation(3)).toBe(`${BASE} Há 3 candidatos ainda em andamento (Inscrito, Em análise ou Entrevista).`);
  });
});
