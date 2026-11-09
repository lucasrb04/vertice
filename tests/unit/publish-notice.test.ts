import { describe, expect, it } from "vitest";
import { pickPublishNotice } from "@/lib/projects/publish-notice";
import type { PanelOpportunity } from "@/lib/projects/queries";

const OPEN_ID = "11111111-1111-4111-8111-111111111111";
const CLOSED_ID = "22222222-2222-4222-8222-222222222222";
const HIDDEN_ID = "33333333-3333-4333-8333-333333333333";

function op(id: string, overrides: Partial<PanelOpportunity> = {}): PanelOpportunity {
  return {
    id,
    slug: `slug-${id.slice(0, 4)}`,
    title: `Processo ${id.slice(0, 4)}`,
    deadlineAt: new Date("2026-12-01T02:59:59Z"),
    closedOn: null,
    vacanciesCount: 1,
    hasExternalUrl: true,
    internalSelectionEnabled: false,
    applicationsCount: 0,
    views: 0,
    externalClicks: 0,
    hidden: false,
    hiddenReason: null,
    ...overrides,
  };
}

const panel = { open: [op(OPEN_ID), op(HIDDEN_ID, { hidden: true })], closed: [op(CLOSED_ID)] };

describe("pickPublishNotice", () => {
  it("publicado: processo aberto do projeto", () => {
    expect(pickPublishNotice({ publicado: OPEN_ID }, panel, true)).toEqual({
      kind: "published",
      opportunity: panel.open[0],
    });
  });

  it("publicado não vale para processo encerrado nem oculto", () => {
    expect(pickPublishNotice({ publicado: CLOSED_ID }, panel, true)).toBeNull();
    expect(pickPublishNotice({ publicado: HIDDEN_ID }, panel, true)).toBeNull();
  });

  it("atualizado: aberto ou encerrado, nunca oculto", () => {
    expect(pickPublishNotice({ atualizado: CLOSED_ID }, panel, true)).toEqual({
      kind: "updated",
      opportunity: panel.closed[0],
    });
    expect(pickPublishNotice({ atualizado: HIDDEN_ID }, panel, true)).toBeNull();
  });

  it("id que não é do projeto, que não é uuid ou ausente: nada", () => {
    expect(pickPublishNotice({ publicado: "44444444-4444-4444-8444-444444444444" }, panel, true)).toBeNull();
    expect(pickPublishNotice({ publicado: "<script>" }, panel, true)).toBeNull();
    expect(pickPublishNotice({}, panel, true)).toBeNull();
  });

  it("parâmetro repetido usa só o primeiro valor", () => {
    expect(pickPublishNotice({ publicado: [OPEN_ID, CLOSED_ID] }, panel, true)?.opportunity.id).toBe(OPEN_ID);
  });

  it("quem só lê o painel (revisor, admin sem membership) não vê o aviso", () => {
    expect(pickPublishNotice({ publicado: OPEN_ID }, panel, false)).toBeNull();
  });
});
