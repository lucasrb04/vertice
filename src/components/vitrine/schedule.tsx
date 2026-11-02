import { formatDay } from "@/lib/time";

type ScheduleDates = {
  deadlineAt: Date;
  applicationsOpenOn: string | null;
  interviewStartsOn: string | null;
  interviewEndsOn: string | null;
  resultOn: string | null;
  activitiesStartOn: string | null;
};

function interviewDays(start: string | null, end: string | null): string | null {
  if (start && end && start !== end) return `${formatDay(start)} a ${formatDay(end)}`;
  const day = start ?? end;
  return day ? formatDay(day) : null;
}

/** Cronograma do processo: só as datas preenchidas. O prazo já aparece no bloco de ação, então sozinho não abre seção. */
export function Schedule({ dates }: { dates: ScheduleDates }) {
  const opens = dates.applicationsOpenOn ? formatDay(dates.applicationsOpenOn) : null;
  const interviews = interviewDays(dates.interviewStartsOn, dates.interviewEndsOn);
  const result = dates.resultOn ? formatDay(dates.resultOn) : null;
  const activities = dates.activitiesStartOn ? formatDay(dates.activitiesStartOn) : null;
  if (!opens && !interviews && !result && !activities) return null;

  const rows: [string, string | null][] = [
    ["Abertura das inscrições", opens],
    ["Fim das inscrições", formatDay(dates.deadlineAt)],
    ["Entrevistas", interviews],
    ["Resultado", result],
    ["Início das atividades", activities],
  ];

  return (
    <section aria-labelledby="cronograma">
      <h2 id="cronograma" className="text-lg font-semibold tracking-tight text-stone-900">
        Cronograma
      </h2>
      <dl className="mt-3 divide-y divide-stone-200 border-y border-stone-200 text-sm">
        {rows.map(
          ([label, value]) =>
            value && (
              <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2">
                <dt className="text-stone-600">{label}</dt>
                <dd className="font-mono text-stone-900">{value}</dd>
              </div>
            ),
        )}
      </dl>
    </section>
  );
}
