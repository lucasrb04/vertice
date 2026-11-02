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
