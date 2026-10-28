import Link from "next/link";
import { PublishWizard } from "@/components/projects/publish-wizard";
import { Button } from "@/components/ui/button";
import { requireAuthPage } from "@/lib/auth/guards";
import { listCourses, listProjectsUserCanPublishIn } from "@/lib/projects/queries";
import { getTurnstileConfig } from "@/lib/security/turnstile";

export const metadata = { title: "Publicar processo seletivo — Vértice" };

export default async function PublicarPage({ searchParams }: { searchParams: Promise<{ novo?: string | string[] }> }) {
  const user = await requireAuthPage();
  const { novo } = await searchParams;
  const projects = await listProjectsUserCanPublishIn(user);
  const showWizard = projects.length === 0 || novo === "1";

  let wizard: React.ReactNode = null;
  if (showWizard) {
    const courses = await listCourses(user.institutionId);
    // Só a chave pública e o modo de teste vão ao cliente; o segredo fica no servidor.
    const { siteKey, bypass } = getTurnstileConfig();
    wizard = <PublishWizard courses={courses} siteKey={siteKey} bypass={bypass} />;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-stone-900">Publicar processo seletivo</h1>
      {showWizard ? (
        <>
          <p className="mt-3 text-stone-600">
            Primeiro, conte sobre o projeto; depois, sobre o processo. Nada é publicado até o último passo.
          </p>
          <div className="mt-8">{wizard}</div>
        </>
      ) : (
        <>
          <p className="mt-3 text-stone-600">Escolha o projeto do novo processo seletivo.</p>
          <ul className="mt-8 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projetos/${p.id}/processos/novo`}
                  className="flex items-center justify-between px-5 py-4 text-stone-900 hover:bg-stone-50"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-brand">Novo processo →</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button asChild variant="outline" size="lg" className="px-4">
              <Link href="/publicar?novo=1">Criar novo projeto</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
