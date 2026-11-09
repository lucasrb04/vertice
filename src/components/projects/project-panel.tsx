import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectTile } from "@/components/vitrine/project-tile";
import type { Project, ProjectRole } from "@/db/schema";
import { CATEGORY_LABELS, PROJECT_STATUS_LABELS, ROLE_LABELS, SYSTEM_ADMIN_READ_ONLY } from "@/lib/projects/labels";
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
  inProgressCount,
  hidden = false,
  hiddenReason = null,
}: {
  project: Project;
  /** `null` só para SYSTEM_ADMIN sem membership (somente leitura). */
  role: ProjectRole | null;
  canEdit: boolean;
  canManageMembers: boolean;
  open: PanelOpportunity[];
  closed: PanelOpportunity[];
  inProgressCount: number;
  /** Projeto oculto pela moderação (suspenso ou em revisão). */
  hidden?: boolean;
  hiddenReason?: string | null;
}) {
  const now = new Date();
  const active = project.status === "ACTIVE";
  const base = `/projetos/${project.id}`;

  return (
    <div className="space-y-7">
      <header className="flex gap-4 rounded-2xl bg-surface p-5 shadow-card sm:gap-5 sm:p-7">
        <ProjectTile category={project.category} name={project.name} acronym={project.acronym} size="lg" />
        <div className="min-w-0 space-y-2">
          <h1 className="text-[1.6rem] leading-tight font-extrabold [overflow-wrap:anywhere] text-ink sm:text-[2rem]">
            {project.name}
          </h1>
          <p className="text-ink-2">
            {CATEGORY_LABELS[project.category]}
            {project.acronym && <> · {project.acronym}</>}
          </p>
          <dl className="flex flex-wrap gap-2 text-sm">
            <div
              className={cn(
                "flex gap-1.5 rounded-[9px] px-2.5 py-1",
                active ? "bg-money-soft text-money-ink" : "bg-fact",
              )}
            >
              <dt>Status</dt>
              <dd className="font-semibold">{PROJECT_STATUS_LABELS[project.status]}</dd>
            </div>
            <div className="flex gap-1.5 rounded-[9px] bg-fact px-2.5 py-1">
              <dt className="text-ink-2">Seu papel</dt>
              <dd className="font-semibold text-ink">{role ? ROLE_LABELS[role] : SYSTEM_ADMIN_READ_ONLY}</dd>
            </div>
          </dl>
        </div>
      </header>

      {hidden && (
        <div
          role="status"
          className="space-y-1 rounded-2xl border border-danger-ink/25 bg-danger-soft px-5 py-4 text-danger-ink"
        >
          <p className="font-bold">Oculto pela moderação</p>
          {hiddenReason && <p>{hiddenReason}</p>}
          <p>O painel fica disponível só para leitura e nenhum processo recebe inscrições.</p>
        </div>
      )}

      {!active && !hidden && (
        <p role="status" className="rounded-2xl bg-surface-2 px-5 py-4 text-ink-2 shadow-card">
          Projeto {PROJECT_STATUS_LABELS[project.status].toLowerCase()}: o painel fica disponível só para leitura e
          nenhum processo recebe inscrições.
        </p>
      )}

      <nav aria-label="Ações do projeto" className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <Button asChild>
              <Link href={`${base}/processos/novo`}>Novo processo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${base}/editar`}>Editar projeto</Link>
            </Button>
          </>
        )}
        <Button asChild variant="outline">
          <Link href={`${base}/membros`}>Membros</Link>
        </Button>
        {(active || project.status === "ARCHIVED") && (
          <Button asChild variant="outline">
            <Link href={`/projeto/${project.slug}`}>Ver página pública</Link>
          </Button>
        )}
        {canManageMembers && <ArchiveProjectButton projectId={project.id} inProgressCount={inProgressCount} />}
      </nav>

      <section aria-labelledby="abertos">
        <h2 id="abertos" className="text-[1.2rem] font-bold text-ink">
          Abertos <span className="text-base font-semibold text-ink-3 tabular-nums">{open.length}</span>
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-surface p-5 text-ink-2 shadow-card">Nenhum processo aberto.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl bg-surface shadow-card">
            {open.map((o) => (
              <OpportunityRow
                key={o.id}
                projectId={project.id}
                opportunity={o}
                isOpen
                canEdit={canEdit}
                isMember={role !== null}
                now={now}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="encerrados">
        {closed.length === 0 ? (
          // Sem encerrados não há o que abrir: a seção já diz isso.
          <>
            <div className="flex items-center gap-2">
              <h2 id="encerrados" className="text-[1.2rem] font-bold text-ink">
                Encerrados
              </h2>
              <span className="text-base font-semibold text-ink-3 tabular-nums">0</span>
            </div>
            <p className="mt-3 text-ink-2">Nenhum processo encerrado.</p>
          </>
        ) : (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 select-none">
              <h2 id="encerrados" className="text-[1.2rem] font-bold text-ink">
                Encerrados
              </h2>
              <span className="text-base font-semibold text-ink-3 tabular-nums">{closed.length}</span>
              <span aria-hidden="true" className="text-ink-3 group-open:hidden">
                +
              </span>
              <span aria-hidden="true" className="hidden text-ink-3 group-open:inline">
                −
              </span>
            </summary>
            <ul className="mt-3 divide-y divide-line rounded-2xl bg-surface shadow-card">
              {closed.map((o) => (
                <OpportunityRow
                  key={o.id}
                  projectId={project.id}
                  opportunity={o}
                  isOpen={false}
                  canEdit={canEdit}
                  isMember={role !== null}
                  now={now}
                />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
