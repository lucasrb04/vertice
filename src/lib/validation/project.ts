import { z } from "zod";
import { optionalHttpsUrl, optionalText, restrictedMarkdown } from "./common";

/** Ordem de exibição em todo lugar (home, filtros, formulário); "Outro" sempre no fim. */
export const PROJECT_CATEGORIES = [
  "SCIENTIFIC_INIT",
  "EXTENSION",
  "SPECIAL_PROJECT",
  "PET",
  "JUNIOR_ENTERPRISE",
  "LAB_GROUP",
  "OTHER",
] as const;

export const projectInputSchema = z.object({
  name: z.string().trim().min(3, "O nome deve ter ao menos 3 caracteres.").max(140),
  acronym: optionalText(20),
  category: z.enum(PROJECT_CATEGORIES, { error: "Escolha uma categoria." }),
  institute: optionalText(32),
  advisorName: optionalText(120),
  shortDescription: z.string().trim().min(1, "Informe uma descrição curta.").max(280),
  description: restrictedMarkdown(5000)
    .nullish()
    .transform((v) => (v ? v : null)),
  contactEmail: z.email("E-mail inválido.").max(255),
  websiteUrl: optionalHttpsUrl(255),
  instagramUrl: optionalHttpsUrl(255),
});

export type ProjectInput = z.output<typeof projectInputSchema>;
export type ProjectFormValues = z.input<typeof projectInputSchema>;
