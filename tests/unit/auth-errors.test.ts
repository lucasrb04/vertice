import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { AuthPolicyError, fromAPIError, toAPIError } from "@/lib/auth/errors";

describe("toAPIError / fromAPIError", () => {
  it("ida e volta preserva o código da política", () => {
    const back = fromAPIError(toAPIError(new AuthPolicyError("DOMAIN_NOT_ALLOWED")));
    expect(back).toBeInstanceOf(AuthPolicyError);
    expect((back as AuthPolicyError).code).toBe("DOMAIN_NOT_ALLOWED");
  });

  it("erros que não são de política passam intactos nos dois sentidos", () => {
    const outro = new Error("outro");
    expect(toAPIError(outro)).toBe(outro);
    expect(fromAPIError(outro)).toBe(outro);
  });

  it("APIError com código desconhecido não vira erro de política", () => {
    const api = new APIError("FORBIDDEN", { code: "OUTRA_COISA", message: "x" });
    expect(fromAPIError(api)).toBe(api);
  });

  it("AuthPolicyError já convertido volta igual", () => {
    const err = new AuthPolicyError("ACCOUNT_SUSPENDED");
    expect(fromAPIError(err)).toBe(err);
  });
});
