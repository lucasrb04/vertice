import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getEnv } from "@/env";
import { toAPIError } from "./errors";
import { beforeSessionCreate, beforeUserCreate } from "./hooks";

const env = getEnv();

export const auth = betterAuth({
  appName: "Vértice",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
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

export type Auth = typeof auth;
