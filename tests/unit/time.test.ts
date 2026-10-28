import { describe, expect, it } from "vitest";
import { dayFromDeadline, daysUntil, deadlineFromDay, formatDay, todayInSaoPaulo } from "@/lib/time";

describe("time", () => {
  it("todayInSaoPaulo vira o dia às 03:00 UTC", () => {
    expect(todayInSaoPaulo(new Date("2026-10-28T02:30:00Z"))).toBe("2026-10-27");
    expect(todayInSaoPaulo(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
  });
  it("deadlineFromDay e dayFromDeadline", () => {
    expect(deadlineFromDay("2026-11-10").toISOString()).toBe("2026-11-11T02:59:59.000Z");
    expect(dayFromDeadline(new Date("2026-11-11T02:59:59.000Z"))).toBe("2026-11-10");
  });
  it("formatDay", () => {
    expect(formatDay("2026-03-05")).toBe("05/03/2026");
    expect(formatDay(new Date("2026-11-11T02:59:59.000Z"))).toBe("10/11/2026");
  });
  it("daysUntil", () => {
    expect(daysUntil(deadlineFromDay("2026-11-03"), new Date("2026-10-27T12:00:00Z"))).toBe(7);
    expect(daysUntil(deadlineFromDay("2026-10-27"), new Date("2026-10-28T02:30:00Z"))).toBe(0);
  });
});
