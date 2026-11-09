import { redirect } from "next/navigation";
import { SignInButton } from "@/components/layout/sign-in-button";
import { UnauthorizedError } from "@/lib/auth/errors";
import { resolveActiveUser } from "@/lib/auth/guards";
import { applySlugFromNext, loginContext } from "@/lib/auth/login-context";
import { loginError } from "@/lib/auth/login-error";
import { safeNextPath } from "@/lib/auth/next-path";
import { getSessionUser } from "@/lib/auth/session";
import { getPublicOpportunity } from "@/lib/public/queries";
import { getDefaultInstitution } from "@/lib/tenant";

/** Título do processo público do `next`, para a frase de contexto; oculto ou inexistente não tem título. */
async function applyTitle(next: string): Promise<string | null> {
  const raw = applySlugFromNext(next);
  if (!raw) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return null; // % solto: não é slug de verdade
  }
  // Mesmo limite da página do processo: não vale consultar o banco com lixo.
  if (slug.length > 140 || slug.includes("\0")) return null;
  const institution = await getDefaultInstitution();
  const found = await getPublicOpportunity(institution.id, slug);
  return found?.opportunity.title ?? null;
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);
  try {
    await resolveActiveUser(await getSessionUser());
    redirect(next);
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err;
  }

  const failure = loginError(Array.isArray(error) ? error[0] : error);
  // Código que o Vértice não mapeia (ex.: MISSING_FIELD do Better-Auth): fica no log para diagnóstico.
  if (failure?.unmappedCode) console.warn(`[auth] login recusado com código não mapeado: ${failure.unmappedCode}`);
  const message = failure?.message ?? null;
  const context = loginContext(next, await applyTitle(next));

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-stone-900">Entrar no Vértice</h1>
        {context && <p className="mt-3 [overflow-wrap:anywhere] text-stone-800">{context}</p>}
        <p className="mt-2 text-sm text-stone-600">
          Use sua conta Google @unifei.edu.br. O primeiro acesso cria a sua conta.
        </p>
        {message ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800"
          >
            {message}
          </p>
        ) : null}
        <div className="mt-6">
          <SignInButton next={next} />
        </div>
      </div>
    </section>
  );
}
