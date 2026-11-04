import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyForm } from "@/components/applications/apply-form";
import { Button } from "@/components/ui/button";
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
    <div className="mt-6 space-y-3 rounded-lg border border-stone-300 bg-stone-100 p-4 text-sm text-stone-800">
      <p role="status" className="font-medium text-stone-900">
        {title}
      </p>
      {children}
      <Link href={`/processo/${slug}`} className="block font-medium text-brand underline-offset-4 hover:underline">
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
    <section className="mx-auto max-w-2xl px-4 py-10">
      <p className="font-mono text-xs tracking-wide text-stone-500 uppercase">{project.name}</p>
      <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight [overflow-wrap:anywhere] text-stone-900">
        Candidatar-se: {opportunity.title}
      </h1>
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
    </section>
  );
}
