import { formatDay } from "@/lib/time";
import type { PROJECT_CATEGORIES } from "@/lib/validation/project";

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  SPECIAL_PROJECT: "Projeto especial",
  SCIENTIFIC_INIT: "Iniciação científica",
  EXTENSION: "Extensão",
  JUNIOR_ENTERPRISE: "Empresa júnior",
  PET: "PET",
  LAB_GROUP: "Laboratório / grupo de pesquisa",
  OTHER: "Outro",
};

export const SCHOLARSHIP_LABELS = {
  VOLUNTARY: "Voluntário",
  PAID: "Com bolsa",
  BOTH: "Ambos",
} as const;

export type ScholarshipType = keyof typeof SCHOLARSHIP_LABELS;

/** Texto fixo `DEADLINE_LABEL`: "Inscrições até dd/mm/aaaa, 23h59 (horário de Brasília)". */
export function deadlineLabel(day: Date | string): string {
  return `Inscrições até ${formatDay(day)}, 23h59 (horário de Brasília)`;
}
