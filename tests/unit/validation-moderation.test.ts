import { describe, expect, it } from "vitest";
import { reportReasonEnum } from "@/db/schema/enums";
import { REPORT_REASON_LABELS, REPORT_REASONS } from "@/lib/validation/moderation";

describe("REPORT_REASONS", () => {
  it("é exatamente o enum do banco, na mesma ordem", () => {
    expect([...REPORT_REASONS]).toEqual(reportReasonEnum.enumValues);
  });

  it("todo motivo tem rótulo", () => {
    expect(Object.keys(REPORT_REASON_LABELS).sort()).toEqual([...REPORT_REASONS].sort());
  });
});
