import Link from "next/link";
import { PublishWizard } from "@/components/projects/publish-wizard";
import { Button } from "@/components/ui/button";
import { requireAuthPage } from "@/lib/auth/guards";
import { listCourses, listProjectsUserCanPublishIn } from "@/lib/projects/queries";
import { getTurnstileConfig } from "@/lib/security/turnstile";

export const metadata = { title: "Publicar processo seletivo — Vértice" };

export default async function PublicarPage({ searchParams }: { searchParams: Promise<{ novo?: string | string[] }> }) {
  const user = await requireAuthPage("/publicar");
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
    <section className="mx-auto w-full max-w-[880px] px-4 pt-8 sm:px-6">
      <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">Publicar processo seletivo</h1>
      {showWizard ? (
        <>
          <p className="mt-2 text-ink-2">
            Primeiro, conte sobre o projeto; depois, sobre o processo. Nada é publicado até o último passo.
          </p>
          <div className="mt-8">{wizard}</div>
        </>
      ) : (
        <>
          <p className="mt-2 text-ink-2">Escolha o projeto do novo processo seletivo.</p>
          <ul className="mt-8 divide-y divide-line rounded-2xl bg-surface shadow-card">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projetos/${p.id}/processos/novo`}
                  className="flex items-center justify-between gap-4 px-5 py-4 text-ink first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-2 sm:px-6"
                >
                  <span className="font-semibold [overflow-wrap:anywhere]">{p.name}</span>
                  <span className="shrink-0 text-sm font-semibold text-ink underline underline-offset-4">
                    Novo processo
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/publicar?novo=1">Criar novo projeto</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
