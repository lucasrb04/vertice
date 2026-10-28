export const TIMEZONE = "America/Sao_Paulo";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia civil (YYYY-MM-DD) de um instante, em Brasília. */
function dayOf(date: Date): string {
  return dayFormatter.format(date);
}

export function todayInSaoPaulo(now: Date = new Date()): string {
  return dayOf(now);
}

/**
 * 23:59:59 do dia informado em Brasília.
 * O Brasil não tem horário de verão desde 2019, então o offset fixo -03:00 é seguro.
 */
export function deadlineFromDay(day: string): Date {
  return new Date(`${day}T23:59:59.000-03:00`);
}

export function dayFromDeadline(deadline: Date): string {
  return dayOf(deadline);
}

/** `dd/mm/aaaa`. Date é lido em Brasília; string YYYY-MM-DD é formatada sem conversão de fuso. */
export function formatDay(value: Date | string): string {
  const day = typeof value === "string" ? value : dayOf(value);
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
}

/** Dias de calendário (Brasília) até o prazo; hoje = 0. */
export function daysUntil(deadline: Date, now: Date = new Date()): number {
  return dayNumber(dayOf(deadline)) - dayNumber(dayOf(now));
}
