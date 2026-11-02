import { z } from "zod";

// Mensagens padrão do Zod em português para regras sem mensagem explícita.
z.config(z.locales.ptBR());

export const HTTPS_ONLY = "Use um link começando com https://";
export const HTML_NOT_ALLOWED = "HTML não é permitido. Use a formatação Markdown.";

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** URL https obrigatória; devolve o valor aparado. */
export function httpsUrl(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .refine(isHttps, { message: HTTPS_ONLY });
}

/** URL https opcional; vazio ou ausente vira null. */
export function optionalHttpsUrl(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isHttps(v), { message: HTTPS_ONLY });
}

/** Texto opcional aparado; vazio ou ausente vira null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
}

const HTML_TAG = /<\/?[a-z!][^>]*>/i;
const MD_LINK_TARGET = /\]\(\s*([^)\s]+)/g;
const MD_REF_DEF = /^\s*\[[^\]]+\]:\s*(\S+)/gm;

export function isRestrictedMarkdown(value: string): { html: boolean; badLink: boolean } {
  let badLink = false;
  for (const m of value.matchAll(MD_LINK_TARGET)) {
    if (!isHttps(m[1])) badLink = true;
  }
  for (const m of value.matchAll(MD_REF_DEF)) {
    if (!isHttps(m[1])) badLink = true;
  }
  return { html: HTML_TAG.test(value), badLink };
}

/** Markdown restrito (D21): sem HTML e só links/imagens https. */
export function restrictedMarkdown(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .superRefine((value, ctx) => {
      const { html, badLink } = isRestrictedMarkdown(value);
      if (html) ctx.addIssue({ code: "custom", message: HTML_NOT_ALLOWED });
      if (badLink) ctx.addIssue({ code: "custom", message: HTTPS_ONLY });
    });
}

export const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida.");

/** Dia opcional; vazio ou ausente vira null. */
export const optionalDay = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(dayString.nullable());

const MAX_CENTS = 99_999_999;

/**
 * Converte valor em reais digitado (pt-BR ou com ponto decimal) para centavos.
 * Devolve null se inválido ou não positivo.
 */
export function parseBrlToCents(input: string): number | null {
  const v = input.trim().replace(/^R\$\s*/i, "");
  let reais: string;
  let frac = "";
  let m: RegExpMatchArray | null;
  if (v.includes(",")) {
    m = v.match(/^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/);
    if (!m) return null;
    reais = m[1].replaceAll(".", "");
    frac = m[2];
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(v)) {
    reais = v.replaceAll(".", "");
  } else {
    m = v.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!m) return null;
    reais = m[1];
    frac = m[2] ?? "";
  }
  const cents = Number(reais) * 100 + Number(frac.padEnd(2, "0") || "0");
  return cents > 0 && cents <= MAX_CENTS ? cents : null;
}
