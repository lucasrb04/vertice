import { describe, expect, it } from "vitest";
import {
  closedChip,
  deadlineChip,
  formatCents,
  plainTextExcerpt,
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

  it("singular em 1 dia", () => {
    expect(deadlineChip(endOfDay("2026-11-03"), now)).toEqual({ text: "Encerra em 1 dia", urgent: true });
  });

  it("7 dias é urgente, 8 não", () => {
    expect(deadlineChip(endOfDay("2026-11-09"), now)).toEqual({ text: "Encerra em 7 dias", urgent: true });
    expect(deadlineChip(endOfDay("2026-11-10"), now)).toEqual({ text: "Encerra em 8 dias", urgent: false });
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
