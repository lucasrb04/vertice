import { createRateLimiter, type RateLimiter } from "./rate-limit";
import { getRequestIp } from "./request-ip";

/** Alto de propósito: o campus pode compartilhar um IP (NAT). Só conta buscas com `q`, a parte cara. */
export const SEARCH_LIMIT_PER_MINUTE = 120;

// Em memória e por processo, coerente com a instância única (D22).
const searchLimiter = createRateLimiter({ limit: SEARCH_LIMIT_PER_MINUTE, windowMs: 60_000 });

/** true se este IP estourou o limite de buscas. Sem `q` ou sem IP válido nunca limita nem consome. */
export function isSearchRateLimited(url: URL, headers: Headers, limiter: RateLimiter = searchLimiter): boolean {
  if (!url.searchParams.get("q")?.trim()) return false;
  const ip = getRequestIp(headers);
  if (!ip) return false;
  return !limiter.consume(ip);
}
