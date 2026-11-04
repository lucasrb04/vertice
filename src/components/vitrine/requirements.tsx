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
      <h2 id="requisitos" className="text-lg font-semibold tracking-tight text-stone-900">
        Requisitos
      </h2>
      <dl className="mt-3 divide-y divide-stone-200 border-y border-stone-200 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <dt className="text-stone-600">{label}</dt>
            <dd className="[overflow-wrap:anywhere] text-stone-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
