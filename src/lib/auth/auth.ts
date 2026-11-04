import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { getEnv } from "@/env";
import { lazy } from "@/lib/lazy";
import { toAPIError } from "./errors";
import { beforeSessionCreate, beforeUserCreate } from "./hooks";

/**
 * Rotas HTTP do Better-Auth que o Vértice não usa. Abertas, deixariam o usuário trocar nome e foto
 * (e se passar por outra pessoa no Kanban), vincular outra conta ou ler o token do Google. Só o
 * roteador HTTP as bloqueia: as chamadas `auth.api.*` do servidor seguem funcionando.
 */
export const DISABLED_AUTH_PATHS = [
  "/update-user",
  "/delete-user",
  "/change-email",
  "/change-password",
  "/set-password",
  "/verify-password",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/verify-email",
  "/link-social",
  "/unlink-account",
  "/list-accounts",
  "/account-info",
  "/get-access-token",
  "/refresh-token",
];

function createAuth() {
  const env = getEnv();
  return betterAuth({
    appName: "Vértice",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
    disabledPaths: DISABLED_AUTH_PATHS,
    database: drizzleAdapter(getDb(), { provider: "pg", schema, usePlural: true }),
    advanced: {
      // O banco usa colunas uuid com default gen_random_uuid() (D16, Zero IDOR).
      database: { generateId: "uuid" },
    },
    // Sem senha, sem e-mail de verificação (D32): só o provider Google.
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: "select_account",
        // Conveniência de UX; o servidor revalida domínio e e-mail verificado nos hooks (D31/D32).
        hd: "unifei.edu.br",
      },
    },
    user: {
      additionalFields: {
        institutionId: { type: "string", required: true, input: false },
        systemRole: { type: "string", required: false, defaultValue: "USER", input: false },
        isBanned: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    session: {
      // Desligado: banimento precisa valer já na próxima requisição (a sessão é lida do banco).
      cookieCache: { enabled: false },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            try {
              const policy = await beforeUserCreate({ email: user.email, emailVerified: user.emailVerified });
              return { data: { ...user, ...policy } };
            } catch (err) {
              throw toAPIError(err);
            }
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            try {
              await beforeSessionCreate({ userId: session.userId });
            } catch (err) {
              throw toAPIError(err);
            }
          },
        },
      },
    },
    // Recusas no callback do Google voltam para /entrar?error=<código>.
    onAPIError: { errorURL: "/entrar" },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Instância real (memoizada). Criada no primeiro uso, nunca no import (spec §6.5). */
export function getAuth(): ReturnType<typeof createAuth> {
  instance ??= createAuth();
  return instance;
}

export const auth = lazy(getAuth);

export type Auth = ReturnType<typeof getAuth>;
