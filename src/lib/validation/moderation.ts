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
