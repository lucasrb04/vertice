import Link from "next/link";
import { notFound } from "next/navigation";
import { OpportunityForm } from "@/components/projects/opportunity-form";
import { listCourses } from "@/lib/projects/queries";
import { loadProjectEditPage } from "../../access";
import { loadOpportunityValuesPage } from "../../opportunity-values";

export const metadata = { title: "Novo processo seletivo — Vértice" };

export default async function NewOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ duplicar?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { duplicar } = await searchParams;
  const { user, project } = await loadProjectEditPage(projectId);
  if (Array.isArray(duplicar)) notFound();

  const source =
    duplicar !== undefined ? await loadOpportunityValuesPage(user, project.id, duplicar, "duplicate") : null;
  const courses = await listCourses(project.institutionId);

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href={`/projetos/${project.id}`}
        className="text-sm font-semibold text-ink underline underline-offset-4 hover:decoration-2"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-stone-900">
        {source ? "Duplicar processo seletivo" : "Novo processo seletivo"}
      </h1>
      {source && (
        <p className="mt-3 text-stone-600">
          Os dados do processo anterior já estão preenchidos. Escolha o novo prazo e as novas datas do cronograma.
        </p>
      )}
      <div className="mt-8">
        <OpportunityForm
          mode={source ? "duplicate" : "create"}
          projectId={project.id}
          courses={courses}
          category={project.category}
          initialValues={source?.values}
          initialTagNames={source?.tagNames}
        />
      </div>
    </section>
  );
}
