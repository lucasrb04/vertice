import { CATEGORY_LABELS, SCHOLARSHIP_LABELS, type ScholarshipType } from "@/lib/projects/labels";
import { daysUntil, formatDay, TIMEZONE } from "@/lib/time";

export { CATEGORY_LABELS, SCHOLARSHIP_LABELS };

export type DeadlineChip = { text: string; urgent: boolean };

const URGENT_DAYS = 3;

/** Prazo de um processo aberto, em dias de calendário de Brasília. */
export function deadlineChip(deadlineAt: Date, now: Date = new Date()): DeadlineChip {
  const days = daysUntil(deadlineAt, now);
  const text = days <= 0 ? "Encerra hoje" : days === 1 ? "Encerra amanhã" : `Encerra em ${days} dias`;
  return { text, urgent: days <= URGENT_DAYS };
}

const shortDay = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: TIMEZONE });

/** `12 nov`: dia e mês abreviado, no dia de Brasília. */
export function deadlineDate(value: Date): string {
  return shortDay.format(value).replace(/\./g, "").replace(" de ", " ");
}

const RECENT_DAYS = 30;

/** Quando o processo entrou na vitrine, contado em dias de calendário de Brasília. */
export function publishedLabel(publishedAt: Date, now: Date = new Date()): string {
  const days = -daysUntil(publishedAt, now);
  if (days <= 0) return "Publicado hoje";
  if (days === 1) return "Publicado ontem";
  if (days <= RECENT_DAYS) return `Publicado há ${days} dias`;
  return `Publicado em ${deadlineDate(publishedAt)}`;
}

/** Por onde o aluno se inscreve, para o rodapé do card. */
export function applicationRouteLabel(card: { internalSelectionEnabled: boolean; hasExternalUrl: boolean }): string {
  if (card.internalSelectionEnabled && card.hasExternalUrl) return "Pelo Vértice ou pelo edital";
  return card.internalSelectionEnabled ? "Inscrição pelo Vértice" : "Edital externo";
}

export function coursesLabel(courseCount: number): string {
  return courseCount === 0 ? "Todos os cursos" : courseCount === 1 ? "1 curso" : `${courseCount} cursos`;
}

/** Prazo de um processo encerrado; `closedOn` pode faltar (ex.: pausado com prazo futuro). */
export function closedChip(closedOn: Date | null): DeadlineChip {
  return { text: closedOn ? `Encerrado em ${formatDay(closedOn)}` : "Encerrado", urgent: false };
}

export function requirementsSummary(card: { courseCount: number; minSemester: number | null }): string {
  const { courseCount, minSemester } = card;
  const courses = coursesLabel(courseCount);
  return minSemester ? `${courses} · A partir do ${minSemester}º período` : courses;
}

/** Rótulo de bolsa para o card, onde "Ambos" sozinho não faria sentido. */
export function scholarshipSummary(card: { scholarshipType: ScholarshipType; fundingAgency: string | null }): string {
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
