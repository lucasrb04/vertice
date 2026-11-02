import type { applicationStatusEnum } from "@/db/schema/enums";

export type ApplicationStatus = (typeof applicationStatusEnum.enumValues)[number];

/** Ordem das colunas do Kanban e do histórico da candidatura. */
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "APPLIED",
  "IN_REVIEW",
  "INTERVIEW",
  "ACCEPTED",
  "REJECTED",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Inscrito",
  IN_REVIEW: "Em análise",
  INTERVIEW: "Entrevista",
  ACCEPTED: "Aprovado",
  REJECTED: "Não selecionado",
};

/** Etapas em que o resultado ainda não saiu. */
export const IN_PROGRESS_STATUSES: readonly ApplicationStatus[] = ["APPLIED", "IN_REVIEW", "INTERVIEW"];
