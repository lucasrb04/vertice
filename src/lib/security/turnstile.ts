import { getEnv, type Env } from "@/env";

/** Chaves públicas de teste da Cloudflare (sempre passam). Só valem fora de produção. */
export const TURNSTILE_TEST_KEYS = {
  siteKey: "1x00000000000000000000AA",
  secretKey: "1x0000000000000000000000000000000AA",
} as const;

/** Token aceito no E2E (mesma condição do login de teste, D33): o teste não depende da rede da Cloudflare. */
export const E2E_TURNSTILE_TOKEN = "e2e-turnstile-token";

export const TURNSTILE_FAILED = "Não foi possível verificar que você não é um robô. Tente de novo.";

/** Lançado pela Server Action quando a verificação falha; `runAction` converte em TURNSTILE_FAILED. */
export class TurnstileFailedError extends Error {
  constructor() {
    super("TURNSTILE_FAILED");
    this.name = "TurnstileFailedError";
  }
}

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

export type TurnstileConfig = { siteKey: string; secretKey: string; bypass: boolean };

export function getTurnstileConfig(env: Env = getEnv()): TurnstileConfig {
  return {
    siteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TURNSTILE_TEST_KEYS.siteKey,
    secretKey: env.TURNSTILE_SECRET_KEY ?? TURNSTILE_TEST_KEYS.secretKey,
    bypass: env.ENABLE_TEST_AUTH && env.NODE_ENV !== "production",
  };
}

export async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
  deps: { fetch?: typeof fetch; config?: TurnstileConfig } = {},
): Promise<boolean> {
  if (!token) return false;
  const config = deps.config ?? getTurnstileConfig();
  if (config.bypass) return token === E2E_TURNSTILE_TOKEN;

  const body = new URLSearchParams({ secret: config.secretKey, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const res = await (deps.fetch ?? fetch)(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json()) as { success?: unknown };
    return json.success === true;
  } catch {
    return false;
  }
}
