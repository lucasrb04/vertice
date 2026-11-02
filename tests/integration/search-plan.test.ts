import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rebuildSearch } from "@/db/search-rebuild";
import { runSeed } from "@/db/seed";
import { searchOpportunities } from "@/lib/public/queries";
import { parseVitrineParams } from "@/lib/public/search-params";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import { mkOpportunity, mkProject } from "../helpers/fixtures";

const failure = vi.hoisted(() => ({ on: false }));

vi.mock("@/lib/search/corrector", async (original) => {
  const actual = await original<typeof import("@/lib/search/corrector")>();
  return {
    ...actual,
    correctQuery: (institutionId: string, q: string) =>
      failure.on ? Promise.reject(new Error("corretor fora")) : actual.correctQuery(institutionId, q),
  };
});

afterEach(() => {
  failure.on = false;
  vi.restoreAllMocks();
});

let inst: string;

beforeEach(async () => {
  await resetDb();
  await runSeed();
  inst = (await getDefaultInstitution()).id;
});

describe("falha do corretor", () => {
  it("segue a busca sem correção e registra o erro", async () => {
    const p = await mkProject({ acronym: null });
    await mkOpportunity(p.id, { title: "Bolsa de Python" });
    await rebuildSearch(inst);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    failure.on = true;
    const r = await searchOpportunities(inst, parseVitrineParams({ q: "python" }));

    expect(r.items.map((i) => i.title)).toEqual(["Bolsa de Python"]);
    expect(r.correction).toBeNull();
    expect(log).toHaveBeenCalled();
  });
});
