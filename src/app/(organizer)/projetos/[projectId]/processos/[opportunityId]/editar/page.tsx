import Link from "next/link";
import { OpportunityForm } from "@/components/projects/opportunity-form";
import { Button } from "@/components/ui/button";
import { OPPORTUNITY_CLOSED, QUESTION_LOCKED } from "@/lib/opportunities/service";
import { listCourses } from "@/lib/projects/queries";
import { loadProjectEditPage } from "../../../access";
import { loadOpportunityValuesPage } from "../../../opportunity-values";

export const metadata = { title: "Editar processo seletivo — Vértice" };

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ projectId: string; opportunityId: string }>;
}) {
  const { projectId, opportunityId } = await params;
  const { user, project } = await loadProjectEditPage(projectId);
  const { values, tagNames, isOpen, hasApplications } = await loadOpportunityValuesPage(
    user,
    project.id,
    opportunityId,
    "edit",
  );
  const courses = isOpen ? await listCourses(project.institutionId) : [];

  return (
    <section className="mx-auto w-full max-w-[880px] px-4 pt-8 sm:px-6">
      <Link
        href={`/projetos/${project.id}`}
        className="text-sm font-semibold text-ink underline underline-offset-4 hover:decoration-2"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-2 text-[1.75rem] leading-tight font-extrabold text-ink">Editar processo seletivo</h1>
      <div className="mt-8">
        {isOpen ? (
          <OpportunityForm
            mode="edit"
            projectId={project.id}
            opportunityId={opportunityId}
            courses={courses}
            category={project.category}
            initialValues={values}
            initialTagNames={tagNames}
            questionLockedHint={hasApplications ? QUESTION_LOCKED : undefined}
          />
        ) : (
          <div className="space-y-4 rounded-2xl bg-surface p-5 shadow-card sm:p-7">
            <p className="font-medium text-stone-900">{values.title}</p>
            <p role="status" className="text-sm text-stone-700">
              {OPPORTUNITY_CLOSED}
            </p>
            <Button asChild size="lg" className="px-4">
              <Link href={`/projetos/${project.id}/processos/novo?duplicar=${opportunityId}`}>Duplicar</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
