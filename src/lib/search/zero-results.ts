import { sql } from "drizzle-orm";
import { db } from "@/db";
import { searchZeroResults } from "@/db/schema";
import type { VitrineParams } from "@/lib/public/search-params";
import { normalizeQuery } from "@/lib/search/corrector";
import { todayInSaoPaulo } from "@/lib/time";

const MAX_TERM = 120;
const RETENTION_DAYS = 90;

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

/** Termo que parece dado pessoal (e-mail, matrícula, telefone) não é gravado. */
function loggable(term: string): boolean {
  return term !== "" && term.length <= MAX_TERM && !term.includes("@") && !/\d{6,}/.test(term);
}

/** Soma 1 ao termo no dia e apaga o que passou de 90 dias na mesma chamada. */
export async function recordZeroResult(institutionId: string, rawQuery: string, now: Date = new Date()): Promise<void> {
  const term = normalizeQuery(rawQuery).replace(/\s+/g, " ");
  if (!loggable(term)) return;
  const day = todayInSaoPaulo(now);
  await db
    .insert(searchZeroResults)
    .values({ institutionId, term, day })
    .onConflictDoUpdate({
      target: [searchZeroResults.institutionId, searchZeroResults.term, searchZeroResults.day],
      set: { count: sql`${searchZeroResults.count} + 1` },
    });
  await db.delete(searchZeroResults).where(sql`${searchZeroResults.day} < ${day}::date - ${RETENTION_DAYS}::int`);
}
