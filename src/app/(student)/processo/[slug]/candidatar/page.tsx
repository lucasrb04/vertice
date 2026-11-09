import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyForm } from "@/components/applications/apply-form";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { ProjectTile } from "@/components/vitrine/project-tile";
import { getApplyContext } from "@/lib/applications/queries";
import { requireAuthPage } from "@/lib/auth/guards";
import { opensInFuture } from "@/lib/opportunities/status";
import { listCourses } from "@/lib/projects/queries";
import { getPublicOpportunity } from "@/lib/public/queries";

export const metadata: Metadata = { title: "Candidatar-se · Vértice" };

// Depende da sessão e do relógio.
export const dynamic = "force-dynamic";

function Notice({ title, slug, children }: { title: string; slug: string; children?: React.ReactNode }) {
  return (
    <div className="mt-6 space-y-3 rounded-2xl bg-surface p-5 text-ink-2 shadow-card">
      <p role="status" className="text-[1.05rem] font-bold text-ink">
        {title}
      </p>
      {children}
      <Link
        href={`/processo/${slug}`}
        className="block font-semibold text-ink underline underline-offset-4 hover:decoration-2"
      >
        Voltar ao processo
      </Link>
    </div>
  );
}

export default async function CandidatarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireAuthPage(`/processo/${encodeURIComponent(slug)}/candidatar`);
  if (slug.length > 140 || slug.includes("\0")) notFound();
  const found = await getPublicOpportunity(user.institutionId, slug);
  if (!found?.opportunity.internalSelectionEnabled) notFound();
  const { opportunity, project, isOpen } = found;

  const [ctx, courses] = await Promise.all([getApplyContext(user, opportunity.id), listCourses(user.institutionId)]);

  let blocked: React.ReactNode = null;
  if (ctx.alreadyApplied) {
    blocked = (
      <Notice title="Você já se candidatou a este processo." slug={slug}>
        <Button asChild variant="outline">
          <Link href="/minhas-candidaturas">Ver minha candidatura</Link>
        </Button>
      </Notice>
    );
  } else if (ctx.isMember) {
    blocked = <Notice title="Você faz parte da equipe deste projeto e não pode se candidatar." slug={slug} />;
  } else if (!isOpen) {
    blocked = <Notice title="Este processo não recebe mais candidaturas." slug={slug} />;
  } else if (opensInFuture(opportunity.applicationsOpenOn)) {
    const [, m, d] = opportunity.applicationsOpenOn!.split("-");
    blocked = <Notice title={`Candidaturas abrem em ${d}/${m}.`} slug={slug} />;
  }

  const p = ctx.profile;
  return (
    <Shell className="mt-8 max-w-[760px]">
      <header className="flex gap-4">
        <ProjectTile category={project.category} name={project.name} acronym={project.acronym} />
        <div className="min-w-0">
          <h1 className="text-[1.6rem] leading-tight font-extrabold [overflow-wrap:anywhere] text-ink sm:text-[1.75rem]">
            Candidatar-se: {opportunity.title}
          </h1>
          <p className="mt-1 [overflow-wrap:anywhere] text-ink-2">{project.name}</p>
        </div>
      </header>
      {blocked ?? (
        <div className="mt-6">
          <ApplyForm
            opportunitySlug={slug}
            question={opportunity.customQuestion}
            courses={courses}
            initial={{
              courseId: p?.courseId ?? "",
              currentSemester: p?.currentSemester ? String(p.currentSemester) : "",
              profileLink: p?.linkedinUrl ?? p?.githubUrl ?? p?.lattesUrl ?? p?.portfolioUrl ?? "",
            }}
            requirements={{
              minSemester: opportunity.minSemester,
              maxSemester: opportunity.maxSemester,
              targetCourseIds: opportunity.targetCourseIds,
            }}
          />
        </div>
      )}
    </Shell>
  );
}
