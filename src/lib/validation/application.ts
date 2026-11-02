import { z } from "zod";
import { optionalHttpsUrl, optionalText } from "./common";

export const ANSWER_MAX = 1000;
export const PROFILE_LINK_MAX = 255;

export const applySchema = z.object({
  opportunitySlug: z.string().trim().min(1).max(140),
  courseId: z.uuid({ error: "Escolha o seu curso." }),
  currentSemester: z.number({ error: "Informe o seu período." }).int().min(1).max(12),
  profileLink: optionalHttpsUrl(PROFILE_LINK_MAX),
  answerText: optionalText(ANSWER_MAX),
});

export type ApplyInput = z.input<typeof applySchema>;
export type ApplyData = z.output<typeof applySchema>;
