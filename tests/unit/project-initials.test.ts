import { describe, expect, it } from "vitest";
import { projectInitials } from "@/lib/projects/initials";

describe("projectInitials", () => {
  it("usa a sigla quando existe", () => {
    expect(projectInitials("Laboratório de Robótica Móvel", "LRM")).toBe("LRM");
  });

  it("sem sigla, até três iniciais ignorando preposições", () => {
    expect(projectInitials("Grupo de Dados Abertos", null)).toBe("GDA");
    expect(projectInitials("laboratório de óptica e física aplicada", null)).toBe("LÓF");
    expect(projectInitials("Robótica", null)).toBe("R");
  });

  it("sigla em branco conta como ausente", () => {
    expect(projectInitials("Equipe Serra Off-Road", "  ")).toBe("ESO");
  });
});
