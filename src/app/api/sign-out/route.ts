import { getEnv } from "@/env";
import { auth } from "@/lib/auth/auth";

/**
 * Encerra a sessão via formulário nativo (funciona antes da hidratação e faz o navegador
 * esperar a resposta, que já traz o cookie expirado). Só aceita requisições da própria origem.
 */
export async function POST(request: Request): Promise<Response> {
  const appOrigin = new URL(getEnv().NEXT_PUBLIC_APP_URL).origin;
  if (request.headers.get("origin") !== appOrigin) {
    return new Response(null, { status: 403 });
  }

  const upstream = await auth.api.signOut({ headers: request.headers, asResponse: true });
  const headers = new Headers({ location: new URL("/", appOrigin).toString() });
  for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}
