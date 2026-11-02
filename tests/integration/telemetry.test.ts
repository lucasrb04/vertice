import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { opportunities, opportunityExternalClicks } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { recordExternalClick, recordView, viewLimiter } from "@/lib/public/telemetry";
import { resetDb } from "../helpers/db";
import { mkOpportunity, mkProject } from "../helpers/fixtures";

const H = 3_600_000;
let oppId: string;
const counts = async () => {
  const [o] = await db.select().from(opportunities).where(eq(opportunities.id, oppId));
  return { clicks: o.externalClicksCount, views: o.viewsCount };
};

beforeEach(async () => {
  await resetDb();
  await runSeed();
  viewLimiter.reset();
  const p = await mkProject({});
  oppId = (await mkOpportunity(p.id)).id;
});

describe("recordExternalClick", () => {
  it("mesmo visitante no mesmo dia conta 1", async () => {
    const now = new Date("2026-11-02T15:00:00Z");
    expect(await recordExternalClick(oppId, "a".repeat(64), now)).toBe(true);
    expect(await recordExternalClick(oppId, "a".repeat(64), new Date(now.getTime() + H))).toBe(false);
    expect((await counts()).clicks).toBe(1);
  });
  it("dia seguinte em Brasília conta 2; outro visitante conta", async () => {
    // 02:30Z = 23:30 do dia anterior em Brasília; 03:30Z = 00:30 do dia seguinte
    await recordExternalClick(oppId, "a".repeat(64), new Date("2026-11-03T02:30:00Z"));
    await recordExternalClick(oppId, "a".repeat(64), new Date("2026-11-03T02:50:00Z"));
    expect((await counts()).clicks).toBe(1);
    await recordExternalClick(oppId, "a".repeat(64), new Date("2026-11-03T03:30:00Z"));
    expect((await counts()).clicks).toBe(2);
    await recordExternalClick(oppId, "b".repeat(64), new Date("2026-11-03T03:30:00Z"));
    expect((await counts()).clicks).toBe(3);
  });
  it("5 cliques simultâneos contam 1", async () => {
    const now = new Date("2026-11-02T15:00:00Z");
    const r = await Promise.all(Array.from({ length: 5 }, () => recordExternalClick(oppId, "c".repeat(64), now)));
    expect(r.filter(Boolean)).toHaveLength(1);
    expect((await counts()).clicks).toBe(1);
    expect(await db.select().from(opportunityExternalClicks)).toHaveLength(1);
  });
});

describe("recordView", () => {
  it("conta 1 por visitante por dia", async () => {
    const now = new Date("2026-11-02T15:00:00Z");
    await recordView(oppId, "d".repeat(64), now);
    await recordView(oppId, "d".repeat(64), now);
    expect((await counts()).views).toBe(1);
    await recordView(oppId, "e".repeat(64), now);
    expect((await counts()).views).toBe(2);
  });
  it("falha no banco não propaga", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordView("not-a-uuid", "f".repeat(64))).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
