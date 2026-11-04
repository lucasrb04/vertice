import { describe, expect, it } from "vitest";
import { type EvalRun, evaluate, ndcgAt, normalizedPrecisionAt, precisionAt } from "../search-eval/metrics";

describe("precisionAt", () => {
  it("conta acertos no topo k dividido por k", () => {
    expect(precisionAt(1, ["a", "b"], ["a"])).toBe(1);
    expect(precisionAt(1, ["b", "a"], ["a"])).toBe(0);
    expect(precisionAt(3, ["a", "x", "b"], ["a", "b", "c"])).toBeCloseTo(2 / 3, 10);
  });
  it("lista curta continua dividindo por k", () => {
    expect(precisionAt(3, ["a"], ["a"])).toBeCloseTo(1 / 3, 10);
  });
  it("sem resultados dá zero", () => {
    expect(precisionAt(3, [], ["a"])).toBe(0);
  });
});

describe("normalizedPrecisionAt", () => {
  it("divide por min(k, esperados)", () => {
    expect(normalizedPrecisionAt(3, ["a"], ["a"])).toBe(1);
    expect(normalizedPrecisionAt(3, ["a", "b", "x"], ["a", "b"])).toBe(1);
    expect(normalizedPrecisionAt(3, ["a", "x", "b"], ["a", "b", "c", "d"])).toBeCloseTo(2 / 3, 10);
    expect(normalizedPrecisionAt(3, ["x"], [])).toBe(0);
  });
});

describe("ndcgAt", () => {
  it("ranking ideal vale 1", () => {
    expect(ndcgAt(10, ["a", "b", "x"], ["a", "b"])).toBeCloseTo(1, 10);
  });
  it("acerto na posição 2 com um esperado: 1/log2(3)", () => {
    expect(ndcgAt(10, ["x", "a"], ["a"])).toBeCloseTo(1 / Math.log2(3), 10);
  });
  it("dois esperados nas posições 1 e 3", () => {
    // DCG = 1 + 1/2 = 1,5; IDCG = 1 + 1/log2(3)
    expect(ndcgAt(10, ["a", "x", "b"], ["a", "b"])).toBeCloseTo(1.5 / (1 + 1 / Math.log2(3)), 10);
  });
  it("respeita o corte k", () => {
    expect(ndcgAt(1, ["x", "a"], ["a"])).toBe(0);
  });
  it("sem esperados ou sem acertos dá zero", () => {
    expect(ndcgAt(10, ["a"], [])).toBe(0);
    expect(ndcgAt(10, ["x"], ["a"])).toBe(0);
  });
});

describe("evaluate", () => {
  const run: EvalRun[] = [
    { query: "q1", category: "exata", expected: ["a"], results: ["a", "b"] },
    { query: "q2", category: "erro", expected: ["a"], results: ["x", "a"] },
    { query: "z1", category: "zero", expected: [], results: [] },
    { query: "z2", category: "zero", expected: [], results: ["a"] },
  ];
  it("agrega só as consultas com esperado; zero conta em zeroRate", () => {
    const r = evaluate(run);
    expect(r.p1).toBeCloseTo(0.5, 10);
    expect(r.p3).toBeCloseTo((1 / 3 + 1 / 3) / 2, 10);
    expect(r.ndcg10).toBeCloseTo((1 + 1 / Math.log2(3)) / 2, 10);
    expect(r.zeroRate).toBeCloseTo(0.5, 10);
    expect(r.perQuery).toHaveLength(4);
    expect(r.perQuery[3]).toMatchObject({ query: "z2", ok: false });
    expect(r.perCategory.exata.p1).toBe(1);
    expect(r.perCategory.zero.zeroRate).toBe(0.5);
  });
});
