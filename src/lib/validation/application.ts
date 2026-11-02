import { z } from "zod";
import { APPLICATION_STATUSES } from "@/lib/applications/labels";
import { optionalHttpsUrl, optionalText } from "./common";

export const ANSWER_MAX = 1000;
export const PROFILE_LINK_MAX = 255;
export const MOVE_ITEMS_MAX = 50;
export const MOVE_MESSAGE_MAX = 2000;

export const applySchema = z.object({
  opportunitySlug: z.string().trim().min(1).max(140),
  courseId: z.uuid({ error: "Escolha o seu curso." }),
  currentSemester: z.number({ error: "Informe o seu período." }).int().min(1).max(12),
  profileLink: optionalHttpsUrl(PROFILE_LINK_MAX),
  answerText: optionalText(ANSWER_MAX),
});

export type ApplyInput = z.input<typeof applySchema>;
export type ApplyData = z.output<typeof applySchema>;

const applicationStatus = z.enum(APPLICATION_STATUSES, { error: "Escolha a etapa." });

export const moveSchema = z.object({
  projectId: z.uuid(),
  opportunityId: z.uuid(),
  items: z
    .array(z.object({ applicationId: z.uuid(), fromStatus: applicationStatus }))
    .min(1)
    .max(MOVE_ITEMS_MAX)
    // Repetido poderia trazer duas etapas de origem para a mesma candidatura.
    .refine((items) => new Set(items.map((i) => i.applicationId)).size === items.length, {
      message: "Candidato repetido na seleção.",
    }),
  toStatus: applicationStatus,
  message: optionalText(MOVE_MESSAGE_MAX),
});

export type MoveInput = z.input<typeof moveSchema>;
