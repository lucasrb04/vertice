import { requireProjectRolePage } from "@/lib/auth/guards";
import { ALL_ROLES } from "@/lib/projects/permissions";
import { getProjectPanel } from "@/lib/projects/queries";
import { deadlineLabel } from "@/lib/projects/labels";

/** Painel provisório (Task 9): nome do projeto e processos abertos. A Task 10 completa. */
export default async function ProjectPanelPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await requireProjectRolePage(projectId, ALL_ROLES, { allowInactive: true });
  const { open } = await getProjectPanel(access);

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-stone-900">{access.project.name}</h1>
      <section aria-labelledby="abertos" className="mt-8">
        <h2 id="abertos" className="text-lg font-semibold tracking-tight text-stone-900">
          Abertos
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">Nenhum processo aberto.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {open.map((o) => (
              <li key={o.id} className="px-5 py-4">
                <p className="font-medium text-stone-900">{o.title}</p>
                <p className="mt-1 font-mono text-xs text-stone-600">{deadlineLabel(o.deadlineAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
