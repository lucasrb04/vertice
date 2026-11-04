import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    DEFAULT_INSTITUTION_SLUG: z.string().min(1).default("unifei-itajuba"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    NEXT_PUBLIC_APP_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    INITIAL_ADMIN_EMAIL: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v) => (v ? v : undefined)),
    ENABLE_TEST_AUTH: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
    TURNSTILE_SECRET_KEY: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
    // Segredo do HMAC que anonimiza visitantes (cliques/visualizações). Obrigatório em produção.
    VISITOR_HASH_SECRET: z
      .string()
      .trim()
      .min(32)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    // Resend: sem chave não há envio (dev, testes e build). Chave e remetente são obrigatórios em produção.
    RESEND_API_KEY: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
    EMAIL_FROM: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      for (const key of [
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        "TURNSTILE_SECRET_KEY",
        "VISITOR_HASH_SECRET",
        "RESEND_API_KEY",
        "EMAIL_FROM",
      ] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "obrigatório em produção" });
      }
    }
    if (env.NODE_ENV === "production" && env.ENABLE_TEST_AUTH) {
      ctx.addIssue({
        code: "custom",
        path: ["ENABLE_TEST_AUTH"],
        message: "não pode ser habilitado em produção",
      });
    }
  });

export type Env = z.output<typeof schema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
    throw new Error(`Variáveis de ambiente inválidas: ${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
