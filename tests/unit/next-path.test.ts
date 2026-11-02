import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

describe("safeNextPath", () => {
  it("aceita caminho interno", () => {
    expect(safeNextPath("/processo/x/candidatar")).toBe("/processo/x/candidatar");
    expect(safeNextPath("/processos?q=a&b=1")).toBe("/processos?q=a&b=1");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/a\\b", "/a\nb", "", "x"])(
    "recusa %j",
    (raw) => {
      expect(safeNextPath(raw)).toBe("/painel");
    },
  );

  it("usa o fallback quando ausente ou recusado", () => {
    expect(safeNextPath(undefined)).toBe("/painel");
    expect(safeNextPath(undefined, "/inicio")).toBe("/inicio");
    expect(safeNextPath("//evil.com", "/inicio")).toBe("/inicio");
  });
});
