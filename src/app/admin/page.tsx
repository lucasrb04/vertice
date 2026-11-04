import { AdminQueue } from "@/components/moderation/admin-queue";
import { requireSystemAdminPage } from "@/lib/auth/guards";
import { listReportQueue, searchModerationTargets } from "@/lib/moderation/queries";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireSystemAdminPage("/admin");
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);
  const [queue, results] = await Promise.all([
    listReportQueue(admin),
    query ? searchModerationTargets(admin, query) : [],
  ]);
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-stone-900">Portal do administrador</h1>
      <p className="mt-3 max-w-prose text-stone-600">Moderação de projetos e processos.</p>
      <div className="mt-10">
        <AdminQueue queue={queue} query={query} results={results} />
      </div>
    </section>
  );
}
