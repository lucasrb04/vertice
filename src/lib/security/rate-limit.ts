interface Hit {
  at: number;
  amount: number;
}

export interface RateLimiter {
  /** Registra `amount` usos para a chave. Retorna false (sem registrar) se estourar o limite. */
  consume(key: string, amount?: number): boolean;
  reset(): void;
}

/** Janela deslizante simples por chave, em memória. Descarta a chave mais antiga acima de `maxKeys`. */
export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const { limit, windowMs, maxKeys = 10_000 } = opts;
  const hits = new Map<string, Hit[]>();

  return {
    consume(key, amount = 1) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((h) => now - h.at < windowMs);
      const used = recent.reduce((sum, h) => sum + h.amount, 0);
      if (used + amount > limit) {
        if (recent.length > 0) hits.set(key, recent);
        else hits.delete(key);
        return false;
      }
      recent.push({ at: now, amount });
      hits.delete(key); // reinsere para manter a ordem de inserção = mais recente por último
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}

export const tagCreationLimiter = createRateLimiter({ limit: 30, windowMs: 3_600_000 });

/** Candidaturas por usuário (D22). */
export const applicationLimiter = createRateLimiter({ limit: 20, windowMs: 3_600_000 });

/** Denúncias por usuário (spec §5). */
export const reportLimiter = createRateLimiter({ limit: 10, windowMs: 86_400_000 });
