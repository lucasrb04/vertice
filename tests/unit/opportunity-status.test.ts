import { describe, expect, it } from "vitest";
import { closedOnDate, isOpportunityOpen, opensInFuture, opensOnLabel } from "@/lib/opportunities/status";
import { deadlineFromDay } from "@/lib/time";

const now = new Date("2026-10-27T12:00:00Z");
const future = new Date("2026-11-01T02:59:59Z");
const past = new Date("2026-10-20T02:59:59Z");

describe("isOpportunityOpen", () => {
  it("regra única", () => {
    expect(isOpportunityOpen({ status: "OPEN", deadlineAt: future }, "ACTIVE", now)).toBe(true);
    expect(isOpportunityOpen({ status: "OPEN", deadlineAt: past }, "ACTIVE", now)).toBe(false);
    expect(isOpportunityOpen({ status: "CLOSED", deadlineAt: future }, "ACTIVE", now)).toBe(false);
    expect(isOpportunityOpen({ status: "UNDER_REVIEW", deadlineAt: future }, "ACTIVE", now)).toBe(false);
    expect(isOpportunityOpen({ status: "PAUSED", deadlineAt: future }, "ACTIVE", now)).toBe(false);
    expect(isOpportunityOpen({ status: "OPEN", deadlineAt: future }, "ARCHIVED", now)).toBe(false);
  });
});

describe("closedOnDate", () => {
  it("closedAt, prazo vencido ou null", () => {
    const closedAt = new Date("2026-10-25T15:00:00Z");
    expect(closedOnDate({ status: "CLOSED", deadlineAt: future, closedAt }, now)).toEqual(closedAt);
    expect(closedOnDate({ status: "OPEN", deadlineAt: past, closedAt: null }, now)).toEqual(past);
    expect(closedOnDate({ status: "OPEN", deadlineAt: future, closedAt: null }, now)).toBeNull();
  });
});

describe("virada do dia em Brasília", () => {
  it("prazo de hoje segue aberto às 23h30 em Brasília e fecha no instante exato", () => {
    const deadlineAt = deadlineFromDay("2026-10-27");
    expect(isOpportunityOpen({ status: "OPEN", deadlineAt }, "ACTIVE", new Date("2026-10-28T02:30:00Z"))).toBe(true);
    expect(isOpportunityOpen({ status: "OPEN", deadlineAt }, "ACTIVE", deadlineAt)).toBe(false);
  });
});

describe("opensInFuture", () => {
  it("sem abertura não há selo", () => {
    expect(opensInFuture(null, now)).toBe(false);
  });

  it("só o dia seguinte em diante é futuro; o próprio dia não", () => {
    expect(opensInFuture("2026-10-28", now)).toBe(true);
    expect(opensInFuture("2026-10-27", now)).toBe(false);
    expect(opensInFuture("2026-10-26", now)).toBe(false);
  });

  it("usa o dia de São Paulo, não o de UTC", () => {
    const lateNight = new Date("2026-11-03T01:00:00Z"); // ainda dia 2 em São Paulo
    expect(opensInFuture("2026-11-02", lateNight)).toBe(false);
    expect(opensInFuture("2026-11-03", lateNight)).toBe(true);
  });
});

describe("opensOnLabel", () => {
  it("formata dd/mm", () => {
    expect(opensOnLabel("2026-11-20")).toBe("Abre em 20/11");
  });
});
