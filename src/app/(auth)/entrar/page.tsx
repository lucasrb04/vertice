import { redirect } from "next/navigation";
import { SignInButton } from "@/components/layout/sign-in-button";
import { isAuthErrorCode, UnauthorizedError, type AuthErrorCode } from "@/lib/auth/errors";
import { resolveActiveUser } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  DOMAIN_NOT_ALLOWED: "Use sua conta @unifei.edu.br.",
  EMAIL_NOT_VERIFIED: "Seu e-mail Google não está verificado.",
  ACCOUNT_SUSPENDED: "Conta suspensa. Fale com a administração do Vértice.",
};

const GENERIC_ERROR_MESSAGE = "Não foi possível entrar. Tente novamente.";

/**
 * Better-Auth 1.7.14 redireciona com `unable_to_get_user_info` quando o `hd` do Google não
 * confere (google.mjs: getUserInfo devolve null -> oauth2/callback.mjs). Na prática, hd divergente;
 * o mesmo código pode vir de outras falhas de userinfo, tratadas como domínio recusado.
 */
const BETTER_AUTH_HD_MISMATCH_CODE = "unable_to_get_user_info";

function errorMessage(raw: string | undefined): string | null {
  if (!raw) return null;
  if (isAuthErrorCode(raw)) return AUTH_ERROR_MESSAGES[raw];
  if (raw === BETTER_AUTH_HD_MISMATCH_CODE) return AUTH_ERROR_MESSAGES.DOMAIN_NOT_ALLOWED;
  return GENERIC_ERROR_MESSAGE;
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  try {
    await resolveActiveUser(await getSessionUser());
    redirect("/painel");
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err;
  }

  const { error } = await searchParams;
  const message = errorMessage(Array.isArray(error) ? error[0] : error);

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-stone-900">
          Entrar no Vértice
        </h1>
        <p className="mt-2 text-stone-600">Use sua conta Google @unifei.edu.br.</p>
        {message ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800"
          >
            {message}
          </p>
        ) : null}
        <div className="mt-6">
          <SignInButton />
        </div>
      </div>
    </section>
  );
}
