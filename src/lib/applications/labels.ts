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

/** Etapas em que o resultado sai: o e-mail ao candidato pede confirmação antes do envio. */
export const FINAL_STATUSES: readonly ApplicationStatus[] = ["ACCEPTED", "REJECTED"];

/** Texto sugerido, editável, para quem não foi selecionado. */
export const REJECTION_SUGGESTION =
  "Obrigado pelo interesse e pelo tempo dedicado a este processo. Desta vez não vamos seguir com a sua candidatura, " +
  "mas esperamos ver você nos próximos processos do projeto.";
