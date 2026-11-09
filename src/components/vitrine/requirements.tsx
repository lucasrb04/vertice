import { semesterRange } from "@/lib/public/labels";

export function Requirements({
  courses,
  minSemester,
  maxSemester,
  availability,
  noOtherScholarship,
}: {
  courses: { code: string; name: string }[];
  minSemester: number | null;
  maxSemester: number | null;
  availability: string | null;
  noOtherScholarship: boolean;
}) {
  const semesters = semesterRange(minSemester, maxSemester);
  const courseList =
    courses.length === 0 ? (
      "Todos os cursos"
    ) : (
      <ul className="space-y-0.5">
        {courses.map((c) => (
          <li key={c.code}>{c.name}</li>
        ))}
      </ul>
    );
  const rows: [string, React.ReactNode][] = [["Cursos", courseList]];
  if (semesters) rows.push(["Período", semesters]);
  if (availability) rows.push(["Disponibilidade", availability]);
  if (noOtherScholarship) rows.push(["Bolsa", "Não acumular com outra bolsa"]);

  return (
    <section aria-labelledby="requisitos">
      <h2 id="requisitos" className="text-[1.2rem] font-bold text-ink">
        Requisitos
      </h2>
      <dl className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-surface-2 px-4 text-[0.97rem]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-ink-2">{label}</dt>
            <dd className="font-medium [overflow-wrap:anywhere] text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
