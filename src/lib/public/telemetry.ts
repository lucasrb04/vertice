import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { opportunities, opportunityExternalClicks } from "@/db/schema";
import { type Env, getEnv } from "@/env";
import { logError } from "@/lib/log";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { todayInSaoPaulo } from "@/lib/time";

export function getVisitorHashSecret(env: Env = getEnv()): string {
  if (env.NODE_ENV === "production") {
    if (!env.VISITOR_HASH_SECRET || env.VISITOR_HASH_SECRET.length < 32) {
      throw new Error("VISITOR_HASH_SECRET obrigatório em produção (mínimo 32 caracteres)");
    }
    return env.VISITOR_HASH_SECRET;
  }
  return env.VISITOR_HASH_SECRET ?? "vertice-dev-visitor-hash-secret-nao-usar-em-producao";
}

/** HMAC-SHA256 hex (64) de IP + User-Agent. O IP bruto nunca é armazenado. */
export function visitorHash(ip: string | null, userAgent: string | null, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${ip ?? ""}\n${userAgent ?? ""}`)
    .digest("hex");
}

/** Registra um clique no edital externo; true se for o primeiro do visitante no dia (Brasília). */
export async function recordExternalClick(
  opportunityId: string,
  hash: string,
  now: Date = new Date(),
): Promise<boolean> {
  const day = todayInSaoPaulo(now);
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(opportunityExternalClicks)
      .values({ opportunityId, visitorHash: hash, day })
      .onConflictDoNothing()
      .returning({ id: opportunityExternalClicks.id });
    if (inserted.length === 0) return false;
    await tx
      .update(opportunities)
      .set({ externalClicksCount: sql`${opportunities.externalClicksCount} + 1` })
      .where(eq(opportunities.id, opportunityId));
    return true;
  });
}

// Uma visualização por visitante/processo/dia, deduplicada em memória (por instância).
export const viewLimiter = createRateLimiter({ limit: 1, windowMs: 24 * 3_600_000, maxKeys: 50_000 });

/** Incrementa visualizações no máximo uma vez por visitante/dia. Nunca lança. */
export async function recordView(opportunityId: string, hash: string, now: Date = new Date()): Promise<void> {
  if (!viewLimiter.consume(`${opportunityId}:${hash}:${todayInSaoPaulo(now)}`)) return;
  try {
    await db
      .update(opportunities)
      .set({ viewsCount: sql`${opportunities.viewsCount} + 1` })
      .where(eq(opportunities.id, opportunityId));
  } catch (error) {
    logError("[telemetria] falha ao registrar visualização", error);
  }
}
