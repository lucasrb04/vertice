import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SafeMarkdown } from "@/components/vitrine/safe-markdown";
import { requireSystemAdminPage } from "@/lib/auth/guards";
import { getModerationContent } from "@/lib/moderation/queries";

export const metadata: Metadata = { title: "Conteúdo denunciado · Vértice", robots: { index: false } };

const TYPES = { projeto: "PROJECT", processo: "OPPORTUNITY" } as const;

/** Leitura, só para admin, do que uma denúncia aponta, inclusive conteúdo já oculto (que dá 404 na vitrine). */
export default async function ConteudoModeradoPage({ params }: { params: Promise<{ tipo: string; id: string }> }) {
  const { tipo, id } = await params;
  const admin = await requireSystemAdminPage(`/admin/conteudo/${tipo}/${id}`);
  const targetType = TYPES[tipo as keyof typeof TYPES];
  if (!targetType) notFound();
  const content = await getModerationContent(admin, targetType, id);
  if (!content) notFound();

  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/admin" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
        Voltar à moderação
      </Link>
      <h1 className="mt-6 font-heading text-2xl font-bold tracking-tight [overflow-wrap:anywhere] text-stone-900">
        {content.name}
      </h1>
      <p className="mt-1 [overflow-wrap:anywhere] text-stone-600">
        {targetType === "OPPORTUNITY" ? `Processo seletivo do projeto ${content.projectName}` : "Página de projeto"}
      </p>

      {content.hidden ? (
        <div className="mt-6 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm">
          <p className="font-medium text-stone-900">Oculto pela moderação</p>
          {content.hiddenReason && (
            <p className="mt-1 [overflow-wrap:anywhere] text-stone-700">{content.hiddenReason}</p>
          )}
          <p className="mt-1 text-stone-600">Só administradores veem esta página.</p>
        </div>
      ) : (
        content.publicPath && (
          <p className="mt-6 text-sm">
            <Link href={content.publicPath} className="font-medium text-brand underline-offset-4 hover:underline">
              Ver página pública
            </Link>
          </p>
        )
      )}

      {content.fields.length > 0 && (
        <dl className="mt-8 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {content.fields.map((f) => (
            <div key={f.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm text-stone-600">{f.label}</dt>
              {/* Texto puro: um link denunciado não vira clicável aqui. */}
              <dd className="text-sm [overflow-wrap:anywhere] text-stone-900">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {content.description && (
        <section aria-labelledby="descricao" className="mt-8">
          <h2 id="descricao" className="text-lg font-semibold tracking-tight text-stone-900">
            Descrição
          </h2>
          <div className="mt-3">
            <SafeMarkdown source={content.description} />
          </div>
        </section>
      )}
    </section>
  );
}
