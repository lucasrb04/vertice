import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { resetDb } from "../helpers/db";
import { mkOpportunity, mkProject } from "../helpers/fixtures";
import { GET } from "@/app/(public)/processo/[slug]/edital/route";

const call = (slug: string) =>
  GET(new Request("http://localhost/processo/x/edital", { headers: { "x-forwarded-for": "203.0.113.5", "user-agent": "t" } }), {
    params: Promise.resolve({ slug }),
  });

beforeEach(async () => {
  await resetDb();
  await runSeed();
});

describe("GET edital", () => {
  it("302 para o edital e conta o clique", async () => {
    const p = await mkProject({});
    const o = await mkOpportunity(p.id, { externalUrl: "https://example.com/edital" });
    const res = await call(o.slug);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/edital");
    const [row] = await db.select().from(opportunities).where(eq(opportunities.id, o.id));
    expect(row.externalClicksCount).toBe(1);
  });
  it("404 sem link externo, oculto, inexistente, NUL ou slug longo", async () => {
    const p = await mkProject({});
    const semLink = await mkOpportunity(p.id, { externalUrl: null, internalSelectionEnabled: true });
    const oculto = await mkOpportunity(p.id, { status: "UNDER_REVIEW" });
    expect((await call(semLink.slug)).status).toBe(404);
    expect((await call(oculto.slug)).status).toBe(404);
    expect((await call("nao-existe")).status).toBe(404);
    expect((await call("a\0b")).status).toBe(404);
    expect((await call("a".repeat(141))).status).toBe(404);
  });
  it("404 se a URL armazenada não for https", async () => {
    const p = await mkProject({});
    const o = await mkOpportunity(p.id, { externalUrl: "http://example.com/x" });
    expect((await call(o.slug)).status).toBe(404);
  });
  it("falha na telemetria não bloqueia o redirect", async () => {
    const p = await mkProject({});
    const o = await mkOpportunity(p.id);
    const tele = await import("@/lib/public/telemetry");
    const s1 = vi.spyOn(tele, "recordExternalClick").mockRejectedValue(new Error("boom"));
    const s2 = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(o.slug)).status).toBe(302);
    s1.mockRestore();
    s2.mockRestore();
  });
});
