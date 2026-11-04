import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { searchZeroResults } from "@/db/schema";
import type { VitrineParams } from "@/lib/public/search-params";
import { normalizeQuery } from "@/lib/search/corrector";
import { todayInSaoPaulo } from "@/lib/time";

const MAX_TERM = 120;
const RETENTION_DAYS = 90;
const MAX_NEW_TERMS_PER_DAY = 1000;

/** Só a busca pura, na primeira página: com filtro o vazio pode vir do filtro, não do termo. */
export function shouldLogZeroResult(params: VitrineParams, total: number): boolean {
  return (
    total === 0 &&
    params.q !== "" &&
    params.page === 1 &&
    params.categories.length === 0 &&
    !params.scholarship &&
    !params.course &&
    params.tags.length === 0 &&
    !params.includeClosed
  );
}

/** Termo que parece dado pessoal (e-mail, matrícula, CPF, telefone: 6+ dígitos no total) não é gravado. */
function loggable(term: string): boolean {
  return term !== "" && term.length <= MAX_TERM && !term.includes("@") && term.replace(/\D/g, "").length < 6;
}

/** Soma 1 ao termo no dia e apaga o que passou de 90 dias na mesma chamada. */
export async function recordZeroResult(institutionId: string, rawQuery: string, now: Date = new Date()): Promise<void> {
  const term = normalizeQuery(rawQuery).replace(/\s+/g, " ");
  if (!loggable(term)) return;
  const day = todayInSaoPaulo(now);
  // Termo já visto no dia sempre soma; um termo novo só entra abaixo do teto diário da instituição.
  const incremented = await db
    .update(searchZeroResults)
    .set({ count: sql`${searchZeroResults.count} + 1` })
    .where(
      and(
        eq(searchZeroResults.institutionId, institutionId),
        eq(searchZeroResults.term, term),
        eq(searchZeroResults.day, day),
      ),
    )
    .returning({ id: searchZeroResults.id });
  if (incremented.length === 0) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(searchZeroResults)
      .where(and(eq(searchZeroResults.institutionId, institutionId), eq(searchZeroResults.day, day)));
    if (n < MAX_NEW_TERMS_PER_DAY) {
      // Corrida com outra gravação do mesmo termo: o upsert soma em vez de falhar.
      await db
        .insert(searchZeroResults)
        .values({ institutionId, term, day })
        .onConflictDoUpdate({
          target: [searchZeroResults.institutionId, searchZeroResults.term, searchZeroResults.day],
          set: { count: sql`${searchZeroResults.count} + 1` },
        });
    }
  }
  await db.delete(searchZeroResults).where(sql`${searchZeroResults.day} < ${day}::date - ${RETENTION_DAYS}::int`);
}
