import { describe, expect, it } from "vitest";
import { projectInputSchema } from "@/lib/validation/project";
import { validProjectInput } from "../helpers/inputs";

describe("projectInputSchema", () => {
  it("aceita entrada válida", () => {
    expect(projectInputSchema.safeParse(validProjectInput()).success).toBe(true);
  });
  it("recusa nome curto", () => {
    expect(projectInputSchema.safeParse(validProjectInput({ name: "ab" })).success).toBe(false);
  });
  it("recusa site que não é https", () => {
    expect(projectInputSchema.safeParse(validProjectInput({ websiteUrl: "http://x.com" })).success).toBe(false);
  });
  it("normaliza opcionais vazios para null", () => {
    const out = projectInputSchema.parse(
      validProjectInput({ websiteUrl: "", instagramUrl: "", acronym: "", institute: "", advisorName: "", description: "" }),
    );
    expect(out.websiteUrl).toBeNull();
    expect(out.instagramUrl).toBeNull();
    expect(out.acronym).toBeNull();
    expect(out.institute).toBeNull();
    expect(out.advisorName).toBeNull();
    expect(out.description).toBeNull();
  });
  it("aceita e-mail de contato de qualquer domínio (D31)", () => {
    expect(projectInputSchema.safeParse(validProjectInput({ contactEmail: "equipe@gmail.com" })).success).toBe(true);
    expect(projectInputSchema.safeParse(validProjectInput({ contactEmail: "invalido" })).success).toBe(false);
  });
  it("recusa HTML na descrição longa e categoria desconhecida", () => {
    expect(projectInputSchema.safeParse(validProjectInput({ description: "<b>x</b>" })).success).toBe(false);
    expect(projectInputSchema.safeParse(validProjectInput({ category: "XYZ" as never })).success).toBe(false);
  });
  it("limita sigla a 20 e descrição curta a 280", () => {
    expect(projectInputSchema.safeParse(validProjectInput({ acronym: "x".repeat(21) })).success).toBe(false);
    expect(projectInputSchema.safeParse(validProjectInput({ shortDescription: "x".repeat(281) })).success).toBe(false);
  });
});
