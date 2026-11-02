import { describe, expect, it } from "vitest";
import {
  NO_CHANNEL,
  makeOpportunitySchema,
  makeWizardSchema,
  type OpportunityFormValues,
} from "@/lib/validation/opportunity";
import { validOpportunityInput, validProjectInput } from "../helpers/inputs";

const s = makeOpportunitySchema({ today: "2026-10-27" });
const v = (o: Partial<OpportunityFormValues>) => validOpportunityInput({ deadline: "2026-11-10", ...o });
const issueMessages = (schema: typeof s, input: unknown) => {
  const r = schema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("makeOpportunitySchema", () => {
  it("aceita entrada válida", () => {
    expect(s.safeParse(v({})).success).toBe(true);
  });
  it("prazo: hoje é aceito, ontem não", () => {
    expect(s.safeParse(v({ deadline: "2026-10-27" })).success).toBe(true);
    expect(s.safeParse(v({ deadline: "2026-10-26" })).success).toBe(false);
  });
  it("exige ao menos um canal", () => {
    expect(issueMessages(s, v({ externalUrl: "" }))).toContain(NO_CHANNEL);
  });
  it("aceita seleção pela plataforma sem link do edital", () => {
    expect(s.safeParse(v({ externalUrl: "", internalSelectionEnabled: true })).success).toBe(true);
  });
  it("pergunta: até 280 caracteres, descartada com a seleção desligada", () => {
    const on = { externalUrl: "", internalSelectionEnabled: true };
    expect(s.safeParse(v({ ...on, customQuestion: "a".repeat(280) })).success).toBe(true);
    expect(s.safeParse(v({ ...on, customQuestion: "a".repeat(281) })).success).toBe(false);
    expect(s.parse(v({ ...on, customQuestion: "  Por que você?  " })).customQuestion).toBe("Por que você?");
    expect(s.parse(v({ ...on, customQuestion: "" })).customQuestion).toBeNull();
    expect(s.parse(v({ internalSelectionEnabled: false, customQuestion: "Por que você?" })).customQuestion).toBeNull();
  });
  it("regras de data do cronograma", () => {
    expect(s.safeParse(v({ applicationsOpenOn: "2026-11-11" })).success).toBe(false);
    expect(s.safeParse(v({ applicationsOpenOn: "2026-11-10" })).success).toBe(true);
    expect(s.safeParse(v({ interviewEndsOn: "2026-11-20" })).success).toBe(false);
    expect(s.safeParse(v({ interviewStartsOn: "2026-11-21", interviewEndsOn: "2026-11-20" })).success).toBe(false);
    expect(s.safeParse(v({ interviewStartsOn: "2026-11-20", interviewEndsOn: "2026-11-20" })).success).toBe(true);
    expect(s.safeParse(v({ resultOn: "2026-11-09" })).success).toBe(false);
    expect(s.safeParse(v({ activitiesStartOn: "2026-11-09" })).success).toBe(false);
  });
  it("limites numéricos", () => {
    expect(s.safeParse(v({ weeklyHours: 21 })).success).toBe(false);
    expect(s.safeParse(v({ weeklyHours: 3 })).success).toBe(false);
    expect(s.safeParse(v({ weeklyHours: 4 })).success).toBe(true);
    expect(s.safeParse(v({ vacanciesCount: 0 })).success).toBe(false);
    expect(s.safeParse(v({ vacanciesCount: 100 })).success).toBe(false);
    expect(s.safeParse(v({ minSemester: 13 })).success).toBe(false);
  });
  it("converte valor da bolsa em centavos", () => {
    expect(s.parse(v({ scholarshipValue: "700,00" })).scholarshipValueCents).toBe(70000);
    expect(s.parse(v({ scholarshipValue: "" })).scholarshipValueCents).toBeNull();
    expect(issueMessages(s, v({ scholarshipValue: "abc" }))).toContain("Valor inválido.");
  });
  it("normaliza opcionais vazios para null", () => {
    const out = s.parse(v({ roleArea: "", fundingAgency: "", availabilityRequirement: "", applicationsOpenOn: "", resultOn: "" }));
    expect(out.roleArea).toBeNull();
    expect(out.fundingAgency).toBeNull();
    expect(out.availabilityRequirement).toBeNull();
    expect(out.applicationsOpenOn).toBeNull();
    expect(out.resultOn).toBeNull();
    expect(out.weeklyHours).toBeNull();
    expect(out.minSemester).toBeNull();
  });
  it("tags: até 10 por grupo", () => {
    const tags = {
      THEME: Array.from({ length: 11 }, (_, i) => ({ name: `tag ${i}` })),
      DESIRED_SKILL: [],
      DEVELOPED_SKILL: [],
    };
    expect(s.safeParse(v({ tags })).success).toBe(false);
  });
  it("cursos: uuids sem duplicatas", () => {
    const id = "6f1c1a52-8f0e-4a8e-9a53-0e1f6a3c2b11";
    expect(s.safeParse(v({ targetCourseIds: [id] })).success).toBe(true);
    expect(s.safeParse(v({ targetCourseIds: [id, id] })).success).toBe(false);
    expect(s.safeParse(v({ targetCourseIds: ["x"] })).success).toBe(false);
  });
  it("descrição recusa HTML", () => {
    expect(s.safeParse(v({ description: "<img src=x>" })).success).toBe(false);
  });
});

describe("makeWizardSchema", () => {
  it("valida projeto e processo juntos", () => {
    const w = makeWizardSchema({ today: "2026-10-27" });
    expect(w.safeParse({ project: validProjectInput(), opportunity: v({}) }).success).toBe(true);
    expect(w.safeParse({ project: validProjectInput({ name: "a" }), opportunity: v({}) }).success).toBe(false);
  });
});

describe("mensagens em português (locale Zod)", () => {
  const msgs = (input: unknown) => issueMessages(s, input).join(" | ");
  const noEnglish = (m: string) => {
    expect(m).not.toMatch(/Too small|Too big|expected|Invalid/);
  };
  it("horas semanais fora da faixa", () => {
    for (const weeklyHours of [2, 21]) {
      const m = msgs(v({ weeklyHours }));
      noEnglish(m);
      expect(m).toMatch(/(Pequeno|Grande) demais/);
    }
  });
  it("vagas 0", () => {
    const m = msgs(v({ vacanciesCount: 0 }));
    noEnglish(m);
    expect(m).toContain("Pequeno demais");
  });
  it("tag com 1 caractere", () => {
    const m = msgs(v({ tags: { THEME: [{ name: "a" }], DESIRED_SKILL: [], DEVELOPED_SKILL: [] } }));
    noEnglish(m);
    expect(m).toContain("Pequeno demais");
  });
});
