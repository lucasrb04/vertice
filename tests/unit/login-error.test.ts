import { describe, expect, it } from "vitest";
import { loginError } from "@/lib/auth/login-error";

describe("loginError", () => {
  it("sem erro, nada a mostrar nem registrar", () => {
    expect(loginError(undefined)).toBeNull();
    expect(loginError("")).toBeNull();
  });

  it("códigos da política do Vértice têm mensagem própria e não vão para o log", () => {
    expect(loginError("DOMAIN_NOT_ALLOWED")).toEqual({ message: "Use sua conta @unifei.edu.br.", unmappedCode: null });
    expect(loginError("ACCOUNT_SUSPENDED")?.unmappedCode).toBeNull();
  });

  it("hd divergente do Google vira domínio recusado", () => {
    expect(loginError("unable_to_get_user_info")?.message).toBe("Use sua conta @unifei.edu.br.");
  });

  it("código desconhecido aparece na mensagem e é marcado para o log", () => {
    expect(loginError("MISSING_FIELD")).toEqual({
      message: "Não foi possível entrar (código MISSING_FIELD). Tente novamente.",
      unmappedCode: "MISSING_FIELD",
    });
  });

  it("valor fora do formato de código não é ecoado na tela nem no log", () => {
    for (const raw of ["<script>alert(1)</script>", "a\nfalso log", "x".repeat(65)]) {
      expect(loginError(raw)).toEqual({
        message: "Não foi possível entrar. Tente novamente.",
        unmappedCode: "codigo_invalido",
      });
    }
  });
});
