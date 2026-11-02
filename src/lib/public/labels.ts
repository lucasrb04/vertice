import { CATEGORY_LABELS, SCHOLARSHIP_LABELS, type ScholarshipType } from "@/lib/projects/labels";
import { daysUntil, formatDay } from "@/lib/time";

export { CATEGORY_LABELS, SCHOLARSHIP_LABELS };

export type DeadlineChip = { text: string; urgent: boolean };

const URGENT_DAYS = 7;

/** Prazo de um processo aberto, em dias de calendário de Brasília. */
export function deadlineChip(deadlineAt: Date, now: Date = new Date()): DeadlineChip {
  const days = daysUntil(deadlineAt, now);
  const text = days <= 0 ? "Encerra hoje" : days === 1 ? "Encerra em 1 dia" : `Encerra em ${days} dias`;
  return { text, urgent: days <= URGENT_DAYS };
}

/** Prazo de um processo encerrado; `closedOn` pode faltar (ex.: pausado com prazo futuro). */
export function closedChip(closedOn: Date | null): DeadlineChip {
  return { text: closedOn ? `Encerrado em ${formatDay(closedOn)}` : "Encerrado", urgent: false };
}

export function requirementsSummary(card: { courseCount: number; minSemester: number | null }): string {
  const { courseCount, minSemester } = card;
  const courses =
    courseCount === 0 ? "Todos os cursos" : courseCount === 1 ? "1 curso" : `${courseCount} cursos`;
  return minSemester ? `${courses} · A partir do ${minSemester}º período` : courses;
}

/** Rótulo de bolsa para o card, onde "Ambos" sozinho não faria sentido. */
export function scholarshipSummary(card: {
  scholarshipType: ScholarshipType;
  fundingAgency: string | null;
}): string {
  const bolsa = card.fundingAgency ? `Bolsa ${card.fundingAgency}` : null;
  switch (card.scholarshipType) {
    case "PAID":
      return bolsa ?? SCHOLARSHIP_LABELS.PAID;
    case "BOTH":
      return `${bolsa ?? "Bolsa"} ou voluntário`;
    case "VOLUNTARY":
      return SCHOLARSHIP_LABELS.VOLUNTARY;
  }
}

/** `R$ 700,00`. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Faixa de períodos dos requisitos, ou `null` sem restrição. */
export function semesterRange(min: number | null, max: number | null): string | null {
  if (min && max) return min === max ? `${min}º período` : `Do ${min}º ao ${max}º período`;
  if (min) return `A partir do ${min}º período`;
  if (max) return `Até o ${max}º período`;
  return null;
}

/** Texto puro para metadados: tira os marcadores de Markdown e corta em palavra inteira. */
export function plainTextExcerpt(source: string, max = 160): string {
  const text = source
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
