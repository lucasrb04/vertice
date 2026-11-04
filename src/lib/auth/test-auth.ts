import { makeSignature } from "better-auth/crypto";
import { getEnv } from "@/env";
import { auth } from "./auth";
import { normalizeEmail } from "./email-policy";
import { fromAPIError } from "./errors";

/** Login de teste (D33): só com ENABLE_TEST_AUTH=true e fora de produção. */
export function isTestAuthEnabled(): boolean {
  const env = getEnv();
  return env.ENABLE_TEST_AUTH && env.NODE_ENV !== "production";
}

/**
 * Cria (ou reaproveita) o usuário e abre uma sessão sem Google. Passa pelo `internalAdapter` do
 * Better-Auth, portanto pelos mesmos `databaseHooks` do login real (beforeUserCreate e
 * beforeSessionCreate). Lança `AuthPolicyError` quando a política recusa.
 */
export async function createTestSession(input: {
  email: string;
  name: string;
}): Promise<{ userId: string; sessionToken: string }> {
  if (!isTestAuthEnabled()) throw new Error("Login de teste desabilitado");
  const ctx = await auth.$context;
  const email = normalizeEmail(input.email);
  try {
    const existing = await ctx.internalAdapter.findUserByEmail(email);
    const user =
      existing?.user ??
      (await ctx.internalAdapter.createUser({ email, name: input.name, emailVerified: true }, { method: "test-auth" }));
    const session = await ctx.internalAdapter.createSession(user.id);
    return { userId: user.id, sessionToken: session.token };
  } catch (err) {
    throw fromAPIError(err);
  }
}

/**
 * Header `Set-Cookie` do cookie de sessão padrão do Better-Auth (mesmo nome, atributos e assinatura
 * HMAC que `setSessionCookie`), para que `auth.api.getSession` aceite o token.
 */
export async function buildSessionCookie(sessionToken: string): Promise<string> {
  const ctx = await auth.$context;
  const { name, attributes } = ctx.authCookies.sessionToken;
  const signed = `${sessionToken}.${await makeSignature(sessionToken, ctx.secret)}`;
  const parts = [`${name}=${encodeURIComponent(signed)}`, `Path=${attributes.path ?? "/"}`];
  parts.push(`Max-Age=${ctx.sessionConfig.expiresIn}`);
  if (attributes.httpOnly ?? true) parts.push("HttpOnly");
  if (attributes.secure) parts.push("Secure");
  const sameSite = typeof attributes.sameSite === "string" ? attributes.sameSite : "lax";
  parts.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1).toLowerCase()}`);
  return parts.join("; ");
}
