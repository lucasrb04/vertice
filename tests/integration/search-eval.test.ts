import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { rebuildSearch } from "@/db/search-rebuild";
import { runSeed } from "@/db/seed";
import { searchOpportunities } from "@/lib/public/queries";
import { parseVitrineParams } from "@/lib/public/search-params";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import { mkOpportunity, mkProject, mkTag, tagOpportunity } from "../helpers/fixtures";
import { corpus, projects } from "../search-eval/corpus";
import { type EvalResult, type EvalRun, evaluate } from "../search-eval/metrics";
import { queries } from "../search-eval/queries";

const BASELINE = join(__dirname, "../search-eval/baseline.json");
const EPS = 1e-9;
// Data fixa: a avaliação não depende do relógio.
const NOW = new Date("2026-10-15T12:00:00Z");
const DAY = 24 * 3_600_000;

type Baseline = {
  p1: number;
  p3: number;
  ndcg10: number;
  zeroRate: number;
  perCategory: EvalResult["perCategory"];
  perQuery: {
    query: string;
    category: string;
    p1: number;
    p3: number;
    ndcg10: number;
    ok: boolean;
    results: string[];
  }[];
};

let result: EvalResult;

beforeAll(async () => {
  await resetDb();
  await runSeed();
  const inst = (await getDefaultInstitution()).id;

  const byKey = new Map<string, string>();
  for (const p of projects) {
    const row = await mkProject({
      name: p.name,
      acronym: p.acronym ?? null,
      advisorName: p.advisorName ?? null,
      category: p.category,
    });
    byKey.set(p.key, row.id);
  }
  for (const [i, c] of corpus.entries()) {
    const state = c.state ?? "open";
    const opp = await mkOpportunity(byKey.get(c.project)!, {
      slug: c.slug,
      title: c.title,
      roleArea: c.roleArea ?? null,
      description: c.description,
      deadlineAt: new Date(NOW.getTime() + (state === "closed" ? -10 : 20) * DAY),
      status: state === "hidden" ? "UNDER_REVIEW" : "OPEN",
      createdAt: new Date(NOW.getTime() - (i + 1) * 3_600_000),
    });
    for (const name of c.tags) await tagOpportunity(opp.id, (await mkTag(name))!.id);
  }
  await rebuildSearch(inst);

  const run: EvalRun[] = [];
  for (const q of queries) {
    const r = await searchOpportunities(inst, parseVitrineParams({ q: q.q }), NOW);
    run.push({ query: q.q, category: q.category, expected: q.expected, results: r.items.map((i) => i.slug) });
  }
  result = evaluate(run);
});

const f = (n: number) => n.toFixed(3);

function printTable(r: EvalResult) {
  const rows = Object.entries(r.perCategory).map(
    ([c, a]) =>
      `${c.padEnd(11)} n=${String(a.n).padStart(2)}  P@1=${f(a.p1)}  P@3=${f(a.p3)}  nP@3=${f(a.np3)}  NDCG@10=${f(a.ndcg10)}  zeroRate=${c === "zero" ? f(a.zeroRate) : "-"}`,
  );
  rows.push(
    `${"TOTAL".padEnd(11)} n=${String(r.n).padStart(2)}  P@1=${f(r.p1)}  P@3=${f(r.p3)}  nP@3=${f(r.np3)}  NDCG@10=${f(r.ndcg10)}  zeroRate=${f(r.zeroRate)}`,
  );
  console.info(`\n${rows.join("\n")}\n`);
}

describe("avaliação da busca", () => {
  it("cobre ao menos 50 consultas e 30 processos, com 10 de zero resultado", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(30);
    expect(queries.length).toBeGreaterThanOrEqual(50);
    expect(queries.filter((q) => q.category === "zero").length).toBeGreaterThanOrEqual(10);
    const slugs = new Set(corpus.map((c) => c.slug));
    for (const q of queries) for (const s of q.expected) expect(slugs.has(s), `${q.q} -> ${s}`).toBe(true);
  });

  it("consultas de zero resultado não devolvem nada", () => {
    const leaks = result.perQuery.filter((p) => p.category === "zero" && p.results.length > 0);
    expect(leaks.map((p) => `${p.query}: ${p.results.join(", ")}`)).toEqual([]);
  });

  it("achados da revisão final", () => {
    const results = (query: string) => result.perQuery.find((p) => p.query === query)!.results;
    const expectedOf = (query: string) => queries.find((q) => q.q === query)!.expected;

    expect(results("casa").slice(0, 2)).toEqual(["casa-inteligente", "acolhimento-familias"]);
    expect(results("casa").indexOf("estudo-de-caso-gestao")).toBeGreaterThan(1);
    for (const q of [
      "ic",
      "ics",
      "ia",
      "ml",
      "machine-learning",
      "html/css",
      "python,java",
      "remunerada",
      "redes nerais",
    ]) {
      expect(results(q), q).toEqual(expect.arrayContaining(expectedOf(q)));
    }
    expect(results("ic")).toContain("pibic-distribuicao");
    expect(results("carteira")).toEqual(["inscricoes-secretaria"]);
  });

  it("não fica abaixo da linha de base (agregado e por consulta)", () => {
    printTable(result);
    const progamacao = result.perQuery.find((p) => p.query === "progamação")!;
    console.info(
      `progamação -> ${progamacao.ok ? "PASSA" : "FALHA"} (resultados: ${progamacao.results.join(", ") || "nenhum"})`,
    );

    if (process.env.UPDATE_BASELINE === "1") {
      const baseline: Baseline = {
        p1: result.p1,
        p3: result.p3,
        ndcg10: result.ndcg10,
        zeroRate: result.zeroRate,
        perCategory: result.perCategory,
        perQuery: result.perQuery.map((p) => ({
          query: p.query,
          category: p.category,
          p1: p.p1,
          p3: p.p3,
          ndcg10: p.ndcg10,
          ok: p.ok,
          results: p.results,
        })),
      };
      writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
      return;
    }

    expect(existsSync(BASELINE), "baseline.json ausente: rode com UPDATE_BASELINE=1").toBe(true);
    const base = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
    expect(result.p1).toBeGreaterThanOrEqual(base.p1 - EPS);
    expect(result.p3).toBeGreaterThanOrEqual(base.p3 - EPS);
    expect(result.ndcg10).toBeGreaterThanOrEqual(base.ndcg10 - EPS);
    expect(result.zeroRate).toBeGreaterThanOrEqual(base.zeroRate - EPS);

    const regressions: string[] = [];
    for (const b of base.perQuery) {
      const cur = result.perQuery.find((p) => p.query === b.query);
      if (!cur) regressions.push(`${b.query}: consulta removida`);
      else if (cur.p1 < b.p1 - EPS || cur.p3 < b.p3 - EPS || cur.ndcg10 < b.ndcg10 - EPS || (b.ok && !cur.ok))
        regressions.push(`${b.query}: regrediu`);
    }
    expect(regressions).toEqual([]);
  });
});
