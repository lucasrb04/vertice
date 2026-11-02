export type Category = "exata" | "derivacao" | "erro" | "diminutivo" | "sinonimo" | "zero";

export type EvalRun = { query: string; category: Category; expected: string[]; results: string[] };

export type QueryScore = {
  query: string;
  category: Category;
  expected: string[];
  results: string[];
  p1: number;
  p3: number;
  /** P@3 normalizado: alcança 1 mesmo com menos de 3 esperados. */
  np3: number;
  ndcg10: number;
  /** Consulta de zero resultado: true se nada voltou. Para as demais, true se o primeiro resultado é esperado. */
  ok: boolean;
};

export type Aggregate = { n: number; p1: number; p3: number; np3: number; ndcg10: number; zeroRate: number };

export type EvalResult = Aggregate & { perQuery: QueryScore[]; perCategory: Record<string, Aggregate> };

/** Precisão no topo k: acertos em `results[0..k)` dividido por k (lista curta continua dividindo por k). */
export function precisionAt(k: number, results: string[], expected: string[]): number {
  const want = new Set(expected);
  const hits = results.slice(0, k).filter((r) => want.has(r)).length;
  return hits / k;
}

/** Acertos no topo k divididos por `min(k, |esperados|)`. Sem esperados: 0. */
export function normalizedPrecisionAt(k: number, results: string[], expected: string[]): number {
  if (expected.length === 0) return 0;
  return (precisionAt(k, results, expected) * k) / Math.min(k, expected.length);
}

/** NDCG@k com relevância binária e desconto log2(posição + 1). Sem esperados: 0. */
export function ndcgAt(k: number, results: string[], expected: string[]): number {
  if (expected.length === 0) return 0;
  const want = new Set(expected);
  const gain = (i: number) => 1 / Math.log2(i + 2);
  let dcg = 0;
  results.slice(0, k).forEach((r, i) => {
    if (want.has(r)) dcg += gain(i);
  });
  let idcg = 0;
  for (let i = 0; i < Math.min(k, expected.length); i++) idcg += gain(i);
  return dcg / idcg;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function aggregate(scores: QueryScore[]): Aggregate {
  const pos = scores.filter((s) => s.category !== "zero");
  const zero = scores.filter((s) => s.category === "zero");
  return {
    n: scores.length,
    p1: mean(pos.map((s) => s.p1)),
    p3: mean(pos.map((s) => s.p3)),
    np3: mean(pos.map((s) => s.np3)),
    ndcg10: mean(pos.map((s) => s.ndcg10)),
    // Fração das consultas de zero resultado que de fato não devolveram nada (maior é melhor).
    zeroRate: mean(zero.map((s) => (s.ok ? 1 : 0))),
  };
}

/** p1, p3, np3 e ndcg10 só sobre consultas com esperado; as de zero resultado contam em `zeroRate`. */
export function evaluate(run: EvalRun[]): EvalResult {
  const perQuery: QueryScore[] = run.map((r) => {
    const isZero = r.category === "zero";
    const p1 = isZero ? 0 : precisionAt(1, r.results, r.expected);
    return {
      query: r.query,
      category: r.category,
      expected: r.expected,
      results: r.results.slice(0, 10),
      p1,
      p3: isZero ? 0 : precisionAt(3, r.results, r.expected),
      np3: isZero ? 0 : normalizedPrecisionAt(3, r.results, r.expected),
      ndcg10: isZero ? 0 : ndcgAt(10, r.results, r.expected),
      ok: isZero ? r.results.length === 0 : p1 === 1,
    };
  });
  const perCategory: Record<string, Aggregate> = {};
  for (const c of new Set(perQuery.map((q) => q.category))) {
    perCategory[c] = aggregate(perQuery.filter((q) => q.category === c));
  }
  return { ...aggregate(perQuery), perQuery, perCategory };
}
