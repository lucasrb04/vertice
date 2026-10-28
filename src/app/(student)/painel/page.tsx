import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAuthPage } from "@/lib/auth/guards";
import { PROJECT_STATUS_LABELS, ROLE_LABELS } from "@/lib/projects/labels";
import { listMyProjects } from "@/lib/projects/queries";

export default async function PainelPage() {
  const user = await requireAuthPage();
  const projects = await listMyProjects(user);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-stone-900">Olá, {user.name}</h1>
      <p className="mt-3 max-w-prose text-stone-600">Suas candidaturas e seu perfil aparecerão aqui.</p>

      <section aria-labelledby="meus-projetos" className="mt-10 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="meus-projetos" className="text-lg font-semibold tracking-tight text-stone-900">
            Meus projetos
          </h2>
          <Button asChild size="lg" className="px-4">
            <Link href="/publicar">Publicar processo seletivo</Link>
          </Button>
        </div>
        {projects.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">Você ainda não participa de nenhum projeto.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projetos/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-stone-900">{p.name}</span>
                    {p.acronym && <span className="ml-2 font-mono text-xs text-stone-500">{p.acronym}</span>}
                    {p.status !== "ACTIVE" && (
                      <span className="ml-2 text-xs text-amber-600">{PROJECT_STATUS_LABELS[p.status]}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-stone-600">{ROLE_LABELS[p.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
