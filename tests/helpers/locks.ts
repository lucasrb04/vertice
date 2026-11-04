import { sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { lockProjectSearchDocuments } from "@/lib/search/index-documents";

/** Espera até alguma sessão estar parada numa trava consultiva, sem horário fixo. */
async function waitForAdvisoryWaiter(): Promise<void> {
  for (let i = 0; i < 500; i++) {
    const { rows } = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from pg_locks where locktype = 'advisory' and not granted`,
    );
    if (rows[0]!.n > 0) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Ninguém esperou pela trava do projeto.");
}

/**
 * Corrida determinística: segura a trava do projeto, dispara `run`, espera ele parar na trava (já
 * depois das checagens feitas fora dela) e só então roda `meanwhile` e libera. Devolve o desfecho de `run`.
 */
export async function raceUnderProjectLock<T>(
  projectId: string,
  run: () => Promise<T>,
  meanwhile: (tx: Tx) => Promise<void>,
): Promise<PromiseSettledResult<T>> {
  let pending: Promise<T> | undefined;
  await db.transaction(async (tx) => {
    await lockProjectSearchDocuments(tx, projectId);
    pending = run();
    pending.catch(() => {});
    await waitForAdvisoryWaiter();
    await meanwhile(tx);
  });
  const [result] = await Promise.allSettled([pending!]);
  return result!;
}
