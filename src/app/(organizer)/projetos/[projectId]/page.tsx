import { ProjectPanel } from "@/components/projects/project-panel";
import { getProjectPanel } from "@/lib/projects/queries";
import { loadProjectReadPage } from "./access";

export const metadata = { title: "Painel do projeto — Vértice" };

export default async function ProjectPanelPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await loadProjectReadPage(projectId);
  const { open, closed, inProgressCount } = await getProjectPanel(access);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <ProjectPanel
        project={access.project}
        role={access.membership?.role ?? null}
        canEdit={access.canEdit}
        canManageMembers={access.canManageMembers}
        open={open}
        closed={closed}
        inProgressCount={inProgressCount}
      />
    </section>
  );
}
