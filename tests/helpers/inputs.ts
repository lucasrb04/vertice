import type { OpportunityFormValues } from "@/lib/validation/opportunity";
import type { ProjectFormValues } from "@/lib/validation/project";
import { todayInSaoPaulo } from "@/lib/time";

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function validProjectInput(overrides: Partial<ProjectFormValues> = {}): ProjectFormValues {
  return {
    name: "Equipe Baja UNIFEI",
    acronym: "BAJA",
    category: "SPECIAL_PROJECT",
    institute: "IEM",
    advisorName: "Prof. Fulano de Tal",
    shortDescription: "Equipe de competição que projeta e constrói um veículo off-road.",
    description: "Somos uma equipe **multidisciplinar**.",
    contactEmail: "baja@unifei.edu.br",
    websiteUrl: "https://unifei.edu.br/baja",
    instagramUrl: "https://instagram.com/bajaunifei",
    ...overrides,
  };
}

export function validOpportunityInput(
  overrides: Partial<OpportunityFormValues> = {},
): OpportunityFormValues {
  return {
    title: "Processo seletivo 2026/2 - Suspensão",
    description: "Atuar no projeto do subsistema de suspensão.",
    roleArea: "Suspensão",
    vacanciesCount: 2,
    deadline: addDays(todayInSaoPaulo(), 14),
    externalUrl: "https://unifei.edu.br/edital.pdf",
    internalSelectionEnabled: false,
    scholarshipType: "VOLUNTARY",
    targetCourseIds: [],
    noOtherScholarship: false,
    tags: { THEME: [], DESIRED_SKILL: [], DEVELOPED_SKILL: [] },
    ...overrides,
  };
}
