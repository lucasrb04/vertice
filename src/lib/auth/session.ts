import { headers } from "next/headers";
import { auth } from "./auth";

/** Sessão crua do Better-Auth. Não confiar nela para banimento: use `resolveActiveUser`. */
export async function getSessionUser(): Promise<{ id: string } | null> {
  // headers() antes de tocar em `auth`: no prerender do build ela marca a rota como dinâmica
  // antes que o ambiente de runtime seja lido (spec §6.5).
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session ? { id: session.user.id } : null;
}
