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

export const ROLE_LABELS = {
  OWNER: "Dono",
  ADMIN: "Administrador",
  REVIEWER: "Revisor",
} as const;

export const PROJECT_STATUS_LABELS = {
  ACTIVE: "Ativo",
  UNDER_REVIEW: "Em revisão",
  SUSPENDED: "Suspenso",
  ARCHIVED: "Arquivado",
} as const;

/** Rótulo do cabeçalho do painel para SYSTEM_ADMIN sem membership (spec §6.6). */
export const SYSTEM_ADMIN_READ_ONLY = "Administrador do sistema (somente leitura)";

/** Texto de confirmação do arquivamento, com os candidatos que ficarão sem resultado, se houver. */
export function archiveConfirmation(inProgressCount: number): string {
  const base = "Arquivar encerra todos os processos do projeto e não pode ser desfeito nesta versão.";
  if (inProgressCount === 0) return base;
  const who = inProgressCount === 1 ? "1 candidato" : `${inProgressCount} candidatos`;
  return `${base} Há ${who} ainda em andamento (Inscrito, Em análise ou Entrevista).`;
}
