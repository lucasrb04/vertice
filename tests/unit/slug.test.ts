import { describe, expect, it } from "vitest";
import { opportunitySlug, projectSlugBase, randomSlugSuffix, slugify } from "@/lib/slug";

describe("slug", () => {
  it("slugify", () => {
    expect(slugify("Equipe Baja — Fórmula SAE!", 90)).toBe("equipe-baja-formula-sae");
    expect(slugify("  C++ & Python  ", 90)).toBe("c-python");
    expect(slugify("🚀🚀", 90)).toBe("");
    expect(slugify("a".repeat(200), 90)).toHaveLength(90);
  });
  it("fallbacks e sufixo", () => {
    expect(projectSlugBase("🚀🚀")).toMatch(/^projeto-[a-z0-9]{4}$/);
    expect(opportunitySlug("Vaga de Telemetria", "k3f9")).toBe("vaga-de-telemetria-k3f9");
    expect(opportunitySlug("!!!", "ab12")).toBe("processo-ab12");
    expect(randomSlugSuffix()).toMatch(/^[a-z0-9]{4}$/);
  });
});
