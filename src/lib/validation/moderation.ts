import { z } from "zod";
import "./common"; // Mensagens do Zod em português

export const MODERATION_TARGETS = ["PROJECT", "OPPORTUNITY"] as const;
export const MODERATION_REASON_MIN = 10;
export const MODERATION_REASON_MAX = 500;

export type ModerationTargetType = (typeof MODERATION_TARGETS)[number];

/** Ocultar, restaurar e descartar: o motivo vai para `audit_logs` e os membros o veem (spec §7). */
export const moderationActionSchema = z.object({
  targetType: z.enum(MODERATION_TARGETS),
  targetId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(MODERATION_REASON_MIN, `O motivo deve ter ao menos ${MODERATION_REASON_MIN} caracteres.`)
    .max(MODERATION_REASON_MAX, `O motivo deve ter no máximo ${MODERATION_REASON_MAX} caracteres.`),
});

export type ModerationActionInput = z.input<typeof moderationActionSchema>;

export const REPORT_REASONS = ["SPAM", "FALSE_INFO", "INAPPROPRIATE", "OTHER"] as const;
export const REPORT_DESCRIPTION_MAX = 500;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "Spam",
  FALSE_INFO: "Informação falsa",
  INAPPROPRIATE: "Conteúdo impróprio",
  OTHER: "Outro",
};

/** Denúncia da comunidade (spec §5). Descrição em branco vira nula. */
export const reportSchema = z.object({
  targetType: z.enum(MODERATION_TARGETS),
  targetId: z.uuid(),
  reasonCode: z.enum(REPORT_REASONS, "Escolha um motivo."),
  description: z
    .string()
    .trim()
    .max(REPORT_DESCRIPTION_MAX, `A descrição deve ter no máximo ${REPORT_DESCRIPTION_MAX} caracteres.`)
    .optional()
    .transform((v) => v || null),
});

export type ReportInput = z.input<typeof reportSchema>;
