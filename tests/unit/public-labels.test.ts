import { describe, expect, it } from "vitest";
import {
  applicationRouteLabel,
  cardScholarshipLabel,
  closedChip,
  coursesLabel,
  deadlineChip,
  deadlineDate,
  formatCents,
  plainTextExcerpt,
  publishedLabel,
  requirementsSummary,
  scholarshipSummary,
  semesterRange,
} from "@/lib/public/labels";

const now = new Date("2026-11-02T15:00:00Z"); // 12h em Brasília
const endOfDay = (day: string) => new Date(`${day}T23:59:59.000-03:00`);

describe("deadlineChip", () => {
  it("hoje é urgente", () => {
    expect(deadlineChip(endOfDay("2026-11-02"), now)).toEqual({ text: "Encerra hoje", urgent: true });
  });

  it("usa o dia de Brasília, não o de UTC", () => {
    // 01h UTC do dia 3 ainda é dia 2 em Brasília.
    const tarde = new Date("2026-11-03T01:00:00Z");
    expect(deadlineChip(endOfDay("2026-11-02"), tarde)).toEqual({ text: "Encerra hoje", urgent: true });
  });

  it("amanhã", () => {
    expect(deadlineChip(endOfDay("2026-11-03"), now)).toEqual({ text: "Encerra amanhã", urgent: true });
  });

  it("3 dias é urgente, 4 não", () => {
    expect(deadlineChip(endOfDay("2026-11-05"), now)).toEqual({ text: "Encerra em 3 dias", urgent: true });
    expect(deadlineChip(endOfDay("2026-11-06"), now)).toEqual({ text: "Encerra em 4 dias", urgent: false });
  });
});

describe("deadlineDate", () => {
  it("dia e mês abreviado, sem ponto, em Brasília", () => {
    expect(deadlineDate(endOfDay("2026-11-12"))).toBe("12 nov");
    expect(deadlineDate(new Date("2026-12-01T01:00:00Z"))).toBe("30 nov");
  });
});

describe("publishedLabel", () => {
  it("hoje, ontem, dias e data", () => {
    expect(publishedLabel(new Date("2026-11-02T10:00:00Z"), now)).toBe("Publicado hoje");
    expect(publishedLabel(new Date("2026-11-01T20:00:00Z"), now)).toBe("Publicado ontem");
    expect(publishedLabel(new Date("2026-10-28T12:00:00Z"), now)).toBe("Publicado há 5 dias");
    expect(publishedLabel(new Date("2026-09-23T12:00:00Z"), now)).toBe("Publicado em 23 set");
  });
});

describe("applicationRouteLabel", () => {
  it("as três formas de inscrição", () => {
    expect(applicationRouteLabel({ internalSelectionEnabled: true, hasExternalUrl: false })).toBe(
      "Inscrição pelo Vértice",
    );
    expect(applicationRouteLabel({ internalSelectionEnabled: false, hasExternalUrl: true })).toBe("Edital externo");
    expect(applicationRouteLabel({ internalSelectionEnabled: true, hasExternalUrl: true })).toBe(
      "Pelo Vértice ou pelo edital",
    );
  });
});

describe("cardScholarshipLabel", () => {
  const base = { fundingAgency: null, scholarshipValueCents: null };
  it("valor, agência e a opção voluntária", () => {
    expect(
      cardScholarshipLabel({
        ...base,
        scholarshipType: "PAID",
        scholarshipValueCents: 70_000,
        fundingAgency: "FAPEMIG",
      }),
    ).toBe("Bolsa de R$ 700/mês · FAPEMIG");
    expect(cardScholarshipLabel({ ...base, scholarshipType: "PAID", scholarshipValueCents: 45_050 })).toBe(
      "Bolsa de R$ 450,50/mês",
    );
    expect(cardScholarshipLabel({ ...base, scholarshipType: "BOTH", scholarshipValueCents: 50_000 })).toBe(
      "Bolsa de R$ 500/mês ou voluntário",
    );
    expect(cardScholarshipLabel({ ...base, scholarshipType: "PAID", fundingAgency: "CNPq" })).toBe("Bolsa CNPq");
    expect(cardScholarshipLabel({ ...base, scholarshipType: "VOLUNTARY" })).toBe("Voluntário");
  });
});

describe("coursesLabel", () => {
  it("todos, um ou vários", () => {
    expect(coursesLabel(0)).toBe("Todos os cursos");
    expect(coursesLabel(1)).toBe("1 curso");
    expect(coursesLabel(4)).toBe("4 cursos");
  });
});

describe("closedChip", () => {
  it("mostra a data quando existe", () => {
    expect(closedChip(endOfDay("2026-10-20"))).toEqual({ text: "Encerrado em 20/10/2026", urgent: false });
  });

  it("sem data diz só Encerrado", () => {
    expect(closedChip(null)).toEqual({ text: "Encerrado", urgent: false });
  });
});

describe("requirementsSummary", () => {
  it("sem cursos definidos vale para todos", () => {
    expect(requirementsSummary({ courseCount: 0, minSemester: null })).toBe("Todos os cursos");
  });

  it("conta cursos e flexiona o singular", () => {
    expect(requirementsSummary({ courseCount: 1, minSemester: null })).toBe("1 curso");
    expect(requirementsSummary({ courseCount: 3, minSemester: null })).toBe("3 cursos");
  });

  it("inclui o período mínimo", () => {
    expect(requirementsSummary({ courseCount: 0, minSemester: 3 })).toBe("Todos os cursos · A partir do 3º período");
    expect(requirementsSummary({ courseCount: 2, minSemester: 5 })).toBe("2 cursos · A partir do 5º período");
  });
});

describe("scholarshipSummary", () => {
  it("voluntário ignora agência", () => {
    expect(scholarshipSummary({ scholarshipType: "VOLUNTARY", fundingAgency: "FAPEMIG" })).toBe("Voluntário");
  });

  it("nomeia a agência quando há bolsa", () => {
    expect(scholarshipSummary({ scholarshipType: "PAID", fundingAgency: "FAPEMIG" })).toBe("Bolsa FAPEMIG");
    expect(scholarshipSummary({ scholarshipType: "PAID", fundingAgency: null })).toBe("Com bolsa");
  });

  it("ambos não fica ambíguo fora do formulário", () => {
    expect(scholarshipSummary({ scholarshipType: "BOTH", fundingAgency: null })).toBe("Bolsa ou voluntário");
    expect(scholarshipSummary({ scholarshipType: "BOTH", fundingAgency: "CNPq" })).toBe("Bolsa CNPq ou voluntário");
  });
});

describe("plainTextExcerpt", () => {
  it("remove marcadores de Markdown", () => {
    expect(
      plainTextExcerpt(
        "# Sobre\n\n**Forte**, *leve* e `código`.\n\n- [edital](https://a.com/x)\n- ![foto](https://a.com/y.png)",
      ),
    ).toBe("Sobre Forte, leve e código. edital foto");
  });

  it("remove definições de referência e citações", () => {
    expect(plainTextExcerpt("> Citação [aqui][a]\n\n1. item\n\n[a]: https://a.com")).toBe("Citação aqui item");
  });

  it("corta em palavra inteira com reticências", () => {
    expect(plainTextExcerpt("uma frase bem comprida para cortar", 15)).toBe("uma frase bem…");
  });

  it("mantém texto curto intacto", () => {
    expect(plainTextExcerpt("Curto.")).toBe("Curto.");
  });
});

describe("formatCents", () => {
  it("formata centavos como reais", () => {
    expect(formatCents(70_000).replace(/\s/g, " ")).toBe("R$ 700,00");
  });
});

describe("semesterRange", () => {
  it("mínimo e máximo iguais viram um período só", () => {
    expect(semesterRange(3, 3)).toBe("3º período");
  });
  it("faixa com mínimo e máximo", () => {
    expect(semesterRange(3, 8)).toBe("Do 3º ao 8º período");
  });
  it("só mínimo", () => {
    expect(semesterRange(3, null)).toBe("A partir do 3º período");
  });
  it("só máximo", () => {
    expect(semesterRange(null, 8)).toBe("Até o 8º período");
  });
  it("sem restrição devolve null", () => {
    expect(semesterRange(null, null)).toBeNull();
  });
});

describe("ordem das categorias", () => {
  it("a mesma na home, nos filtros e no formulário, com Outro no fim", async () => {
    const { PROJECT_CATEGORIES } = await import("@/lib/validation/project");
    expect(PROJECT_CATEGORIES).toEqual([
      "SCIENTIFIC_INIT",
      "EXTENSION",
      "SPECIAL_PROJECT",
      "PET",
      "JUNIOR_ENTERPRISE",
      "LAB_GROUP",
      "OTHER",
    ]);
  });
});
