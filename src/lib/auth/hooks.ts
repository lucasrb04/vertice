import { eq } from "drizzle-orm";
import { db } from "@/db";
import { institutions, users } from "@/db/schema";
import { getEnv } from "@/env";
import { getDefaultInstitution } from "@/lib/tenant";
import { isAllowedEmail, normalizeEmail } from "./email-policy";
import { AuthPolicyError } from "./errors";

export type NewUserPolicyFields = {
  email: string;
  institutionId: string;
  systemRole: "USER" | "SYSTEM_ADMIN";
};

/**
 * Executado antes de criar o usuário (primeiro login). Exige domínio permitido pela instituição
 * padrão (igualdade exata, D31) e e-mail verificado pelo Google (D32).
 */
export async function beforeUserCreate(user: { email: string; emailVerified: boolean }): Promise<NewUserPolicyFields> {
  const email = normalizeEmail(user.email);
  const institution = await getDefaultInstitution();
  if (!isAllowedEmail(email, institution.allowedEmailDomains)) {
    throw new AuthPolicyError("DOMAIN_NOT_ALLOWED");
  }
  if (user.emailVerified !== true) {
    throw new AuthPolicyError("EMAIL_NOT_VERIFIED");
  }
  const initialAdmin = getEnv().INITIAL_ADMIN_EMAIL;
  return {
    email,
    institutionId: institution.id,
    systemRole: initialAdmin !== undefined && email === initialAdmin ? "SYSTEM_ADMIN" : "USER",
  };
}

/**
 * Executado antes de criar qualquer sessão (a cada login). Banido não recebe sessão, e o e-mail
 * guardado precisa continuar dentro da política de domínio da instituição dele.
 */
export async function beforeSessionCreate(session: { userId: string }): Promise<void> {
  const [user] = await db
    .select({
      email: users.email,
      isBanned: users.isBanned,
      allowedEmailDomains: institutions.allowedEmailDomains,
    })
    .from(users)
    .innerJoin(institutions, eq(institutions.id, users.institutionId))
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) throw new AuthPolicyError("DOMAIN_NOT_ALLOWED");
  if (user.isBanned) throw new AuthPolicyError("ACCOUNT_SUSPENDED");
  if (!isAllowedEmail(user.email, user.allowedEmailDomains)) {
    throw new AuthPolicyError("DOMAIN_NOT_ALLOWED");
  }
}
