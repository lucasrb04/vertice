import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSeed } from "@/db/seed";
import { resetDb } from "../helpers/db";
import { mkOpportunity, mkProject } from "../helpers/fixtures";

const SECRET = "select * from sessions params: maria@unifei.edu.br";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => {
    throw new Error(SECRET);
  },
}));

const { default: ProcessoPage } = await import("@/app/(public)/processo/[slug]/page");

describe("página do processo: falha ao consultar a sessão", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("segue sem sessão e o log não traz o erro", async () => {
    const project = await mkProject();
    const opp = await mkOpportunity(project.id, { internalSelectionEnabled: true });

    await expect(ProcessoPage({ params: Promise.resolve({ slug: opp.slug }) })).resolves.toBeTruthy();

    expect(vi.mocked(console.error).mock.calls).toEqual([["[processo] falha ao consultar a sessão"]]);
  });
});
