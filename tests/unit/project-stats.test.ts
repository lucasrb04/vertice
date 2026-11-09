import { describe, expect, it } from "vitest";
import { opportunityStatsParts, projectStatsParts } from "@/lib/projects/stats";

describe("números do projeto", () => {
  it("singular, plural e milhar em pt-BR", () => {
    expect(projectStatsParts({ openOpportunities: 1, inProgressApplications: 1, views: 1, externalClicks: 1 })).toEqual(
      ["1 processo aberto", "1 candidato em andamento", "1 visualização", "1 clique no edital"],
    );
    expect(
      projectStatsParts({ openOpportunities: 0, inProgressApplications: 3, views: 1234, externalClicks: 4 }),
    ).toEqual(["0 processos abertos", "3 candidatos em andamento", "1.234 visualizações", "4 cliques no edital"]);
  });

  it("por processo: visualizações e cliques no edital", () => {
    expect(opportunityStatsParts({ views: 42, externalClicks: 0 })).toEqual([
      "42 visualizações",
      "0 cliques no edital",
    ]);
    expect(opportunityStatsParts({ views: 42, externalClicks: null })).toEqual(["42 visualizações"]);
  });
});
