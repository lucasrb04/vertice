import { headers } from "next/headers";
import { auth } from "./auth";

/** Sessão crua do Better-Auth. Não confiar nela para banimento: use `resolveActiveUser`. */
export async function getSessionUser(): Promise<{ id: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id } : null;
}
