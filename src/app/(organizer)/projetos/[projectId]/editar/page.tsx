import Link from "next/link";
import { ProjectEditForm } from "@/components/projects/project-edit-form";
import type { ProjectDraft } from "@/components/projects/project-fields";
import type { Project } from "@/db/schema";
import { loadProjectEditPage } from "../access";

export const metadata = { title: "Editar projeto — Vértice" };

function toDraft(p: Project): ProjectDraft {
  return {
    name: p.name,
    acronym: p.acronym ?? "",
    category: p.category,
    institute: p.institute ?? "",
    advisorName: p.advisorName ?? "",
    shortDescription: p.shortDescription,
    description: p.description ?? "",
    contactEmail: p.contactEmail,
    websiteUrl: p.websiteUrl ?? "",
    instagramUrl: p.instagramUrl ?? "",
  };
}

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project } = await loadProjectEditPage(projectId);

  return (
    <section className="mx-auto w-full max-w-[880px] px-4 pt-8 sm:px-6">
      <Link
        href={`/projetos/${project.id}`}
        className="text-sm font-semibold text-ink underline underline-offset-4 hover:decoration-2"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-2 text-[1.75rem] leading-tight font-extrabold text-ink">Editar projeto</h1>
      <div className="mt-8">
        <ProjectEditForm projectId={project.id} initialValues={toDraft(project)} />
      </div>
    </section>
  );
}
