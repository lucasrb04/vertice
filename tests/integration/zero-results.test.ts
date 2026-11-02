import { beforeEach, describe, expect, it } from "vitest";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { searchZeroResults } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { parseVitrineParams } from "@/lib/public/search-params";
import { recordZeroResult, shouldLogZeroResult } from "@/lib/search/zero-results";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";

let instId: string;
const rows = () => db.select().from(searchZeroResults).orderBy(asc(searchZeroResults.day), asc(searchZeroResults.term));
const NOW = new Date("2026-11-02T15:00:00Z");

beforeEach(async () => {
  await resetDb();
  await runSeed();
  instId = (await getDefaultInstitution()).id;
});

describe("recordZeroResult", () => {
  it("grava o termo normalizado e soma repetições no mesmo dia", async () => {
    await recordZeroResult(instId, "  Robótica  Quântica ", NOW);
    expect(await rows()).toMatchObject([{ term: "robotica quantica", day: "2026-11-02", count: 1 }]);
    await recordZeroResult(instId, "robotica quantica", new Date(NOW.getTime() + 3_600_000));
    expect(await rows()).toMatchObject([{ count: 2 }]);
  });

  it("outro dia cria nova linha", async () => {
    await recordZeroResult(instId, "robotica", NOW);
    await recordZeroResult(instId, "robotica", new Date("2026-11-03T15:00:00Z"));
    expect((await rows()).map((r) => [r.day, r.count])).toEqual([["2026-11-02", 1], ["2026-11-03", 1]]);
  });

  it("apaga linhas com mais de 90 dias e mantém a de exatamente 90", async () => {
    await recordZeroResult(instId, "velho", new Date("2026-07-24T15:00:00Z")); // 101 dias
    await recordZeroResult(instId, "limite", new Date("2026-08-04T15:00:00Z")); // 90 dias
    await recordZeroResult(instId, "novo", NOW);
    expect((await rows()).map((r) => r.term).sort()).toEqual(["limite", "novo"]);
  });

  it("não grava e-mail, 6+ dígitos seguidos, vazio nem termo longo", async () => {
    for (const q of ["fulano@unifei.edu.br", "matricula 2021001234", "123456", "   ", "a".repeat(121)]) {
      await recordZeroResult(instId, q, NOW);
    }
    expect(await rows()).toHaveLength(0);
    await recordZeroResult(instId, "vaga 12345", NOW);
    expect(await rows()).toHaveLength(1);
  });
});

describe("shouldLogZeroResult", () => {
  const p = (raw: Record<string, string>) => parseVitrineParams(raw);
  it("só com total 0, q, página 1 e sem filtros", () => {
    expect(shouldLogZeroResult(p({ q: "xyz" }), 0)).toBe(true);
    expect(shouldLogZeroResult(p({ q: "xyz", corrigir: "0" }), 0)).toBe(true);
    expect(shouldLogZeroResult(p({ q: "xyz" }), 1)).toBe(false);
    expect(shouldLogZeroResult(p({}), 0)).toBe(false);
    expect(shouldLogZeroResult(p({ q: "xyz", page: "2" }), 0)).toBe(false);
    for (const f of <Record<string, string>[]>[{ category: "LAB_GROUP" }, { scholarship: "PAID" }, { course: "CCO" }, { tags: "python" }, { encerrados: "1" }]) {
      expect(shouldLogZeroResult(p({ q: "xyz", ...f }), 0)).toBe(false);
    }
  });
});
