import { z } from "zod";
import { optionalDay, optionalHttpsUrl, optionalText, parseBrlToCents, restrictedMarkdown, dayString } from "./common";
import { projectInputSchema } from "./project";

export const NO_CHANNEL = "Informe o link do edital ou ative a seleção pela plataforma.";

export const tagRefSchema = z.union([
  z.object({ id: z.uuid() }),
  z.object({ name: z.string().trim().min(2).max(64) }),
]);
export type TagRef = z.infer<typeof tagRefSchema>;

export const TAG_GROUPS = ["THEME", "DESIRED_SKILL", "DEVELOPED_SKILL"] as const;
export type TagGroup = (typeof TAG_GROUPS)[number];

const tagList = z.array(tagRefSchema).max(10, "No máximo 10 tags por grupo.").default([]);

const optionalInt = (min: number, max: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(max)
    .nullish()
    .transform((v) => v ?? null);

export function makeOpportunitySchema(opts: { today: string }) {
  return z
    .object({
      title: z.string().trim().min(5, "O título deve ter ao menos 5 caracteres.").max(160),
      description: restrictedMarkdown(5000).min(1, "Descreva as atividades."),
      roleArea: optionalText(80),
      vacanciesCount: z.number().int().min(1).max(99).default(1),
      deadline: dayString,
      externalUrl: optionalHttpsUrl(500),
      internalSelectionEnabled: z.boolean().default(false),
      customQuestion: optionalText(280),
      scholarshipType: z.enum(["VOLUNTARY", "PAID", "BOTH"]).default("VOLUNTARY"),
      fundingAgency: optionalText(64),
      scholarshipValue: z
        .string()
        .trim()
        .nullish()
        .transform((v) => (v ? v : null))
        .refine((v) => v === null || parseBrlToCents(v) !== null, { message: "Valor inválido." }),
      weeklyHours: optionalInt(4, 20),
      applicationsOpenOn: optionalDay,
      interviewStartsOn: optionalDay,
      interviewEndsOn: optionalDay,
      resultOn: optionalDay,
      activitiesStartOn: optionalDay,
      targetCourseIds: z
        .array(z.uuid())
        .max(50)
        .refine((ids) => new Set(ids).size === ids.length, { message: "Cursos repetidos." })
        .default([]),
      minSemester: optionalInt(1, 12),
      availabilityRequirement: optionalText(200),
      noOtherScholarship: z.boolean().default(false),
      tags: z
        .object({ THEME: tagList, DESIRED_SKILL: tagList, DEVELOPED_SKILL: tagList })
        .default({ THEME: [], DESIRED_SKILL: [], DEVELOPED_SKILL: [] }),
    })
    .superRefine((o, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: "custom", path: [path], message });

      if (!o.externalUrl && !o.internalSelectionEnabled) issue("externalUrl", NO_CHANNEL);

      if (o.deadline < opts.today) issue("deadline", "O prazo não pode ser anterior a hoje.");
      if (o.applicationsOpenOn && o.applicationsOpenOn > o.deadline)
        issue("applicationsOpenOn", "A abertura das inscrições deve ser até o prazo final.");
      if (o.interviewEndsOn && !o.interviewStartsOn)
        issue("interviewStartsOn", "Informe o início da entrevista.");
      if (o.interviewStartsOn && o.interviewEndsOn && o.interviewStartsOn > o.interviewEndsOn)
        issue("interviewEndsOn", "O fim da entrevista deve ser depois do início.");
      if (o.resultOn && o.resultOn < o.deadline)
        issue("resultOn", "O resultado deve ser depois do prazo final.");
      if (o.activitiesStartOn && o.activitiesStartOn < o.deadline)
        issue("activitiesStartOn", "O início das atividades deve ser depois do prazo final.");
    })
    .transform(({ scholarshipValue, ...rest }) => ({
      ...rest,
      // A pergunta só vale com a seleção pela plataforma ligada.
      customQuestion: rest.internalSelectionEnabled ? rest.customQuestion : null,
      scholarshipValueCents: scholarshipValue === null ? null : parseBrlToCents(scholarshipValue),
    }));
}

export type OpportunityInput = z.output<ReturnType<typeof makeOpportunitySchema>>;
export type OpportunityFormValues = z.input<ReturnType<typeof makeOpportunitySchema>>;

export function makeWizardSchema(opts: { today: string }) {
  return z.object({ project: projectInputSchema, opportunity: makeOpportunitySchema(opts) });
}
