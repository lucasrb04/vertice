import Link from "next/link";
import type { Project, ProjectRole } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  ROLE_LABELS,
  SYSTEM_ADMIN_READ_ONLY,
} from "@/lib/projects/labels";
import type { PanelOpportunity } from "@/lib/projects/queries";
import { cn } from "@/lib/utils";
import { ArchiveProjectButton } from "./archive-project-button";
import { OpportunityRow } from "./opportunity-row";

/** Painel do projeto (spec §6.9): cabeçalho, atalhos conforme o papel, abertos e encerrados. */
export function ProjectPanel({
  project,
  role,
  canEdit,
  canManageMembers,
  open,
  closed,
}: {
  project: Project;
  /** `null` só para SYSTEM_ADMIN sem membership (somente leitura). */
  role: ProjectRole | null;
  canEdit: boolean;
  canManageMembers: boolean;
  open: PanelOpportunity[];
  closed: PanelOpportunity[];
}) {
  const now = new Date();
  const active = project.status === "ACTIVE";
  const base = `/projetos/${project.id}`;

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-stone-200 pb-6">
        <p className="font-mono text-xs tracking-wide text-stone-500 uppercase">{CATEGORY_LABELS[project.category]}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-stone-900">{project.name}</h1>
          {project.acronym && <span className="font-mono text-sm text-stone-600">{project.acronym}</span>}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-stone-500">Status</dt>
            <dd className={cn("font-medium", active ? "text-stone-900" : "text-stone-600")}>
              {PROJECT_STATUS_LABELS[project.status]}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-stone-500">Seu papel</dt>
            <dd className="font-medium text-stone-900">{role ? ROLE_LABELS[role] : SYSTEM_ADMIN_READ_ONLY}</dd>
          </div>
        </dl>
      </header>

      {!active && (
        <p role="status" className="rounded-lg border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-stone-700">
          Projeto {PROJECT_STATUS_LABELS[project.status].toLowerCase()}: o painel fica disponível só para leitura e
          nenhum processo recebe inscrições.
        </p>
      )}

      <nav aria-label="Ações do projeto" className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <Button asChild size="lg" className="px-4">
              <Link href={`${base}/processos/novo`}>Novo processo</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-4">
              <Link href={`${base}/editar`}>Editar projeto</Link>
            </Button>
          </>
        )}
        <Button asChild variant="outline" size="lg" className="px-4">
          <Link href={`${base}/membros`}>Membros</Link>
        </Button>
        {canManageMembers && <ArchiveProjectButton projectId={project.id} />}
      </nav>

      <section aria-labelledby="abertos">
        <h2 id="abertos" className="text-lg font-semibold tracking-tight text-stone-900">
          Abertos <span className="font-mono text-sm font-normal text-stone-500">{open.length}</span>
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">Nenhum processo aberto.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {open.map((o) => (
              <OpportunityRow key={o.id} projectId={project.id} opportunity={o} isOpen canEdit={canEdit} now={now} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="encerrados">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 select-none">
            <h2 id="encerrados" className="text-lg font-semibold tracking-tight text-stone-900">
              Encerrados
            </h2>
            <span className="font-mono text-sm text-stone-500">{closed.length}</span>
            <span aria-hidden="true" className="font-mono text-sm text-stone-500 group-open:hidden">
              +
            </span>
            <span aria-hidden="true" className="hidden font-mono text-sm text-stone-500 group-open:inline">
              −
            </span>
          </summary>
          {closed.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">Nenhum processo encerrado.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
              {closed.map((o) => (
                <OpportunityRow
                  key={o.id}
                  projectId={project.id}
                  opportunity={o}
                  isOpen={false}
                  canEdit={canEdit}
                  now={now}
                />
              ))}
            </ul>
          )}
        </details>
      </section>
    </div>
  );
}
