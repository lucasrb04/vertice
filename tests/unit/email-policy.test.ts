import { describe, expect, it } from "vitest";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth/email-policy";

const D = ["unifei.edu.br"];

describe("isAllowedEmail", () => {
  it.each([
    ["aluno@unifei.edu.br", true],
    ["Aluno@UNIFEI.EDU.BR", true],
    [" aluno@unifei.edu.br ", true],
    ["aluno@evilunifei.edu.br", false],
    ["aluno@foo.unifei.edu.br", false],
    ["aluno@unifei.edu.br.evil.com", false],
    ["aluno@gmail.com", false],
    ["sem-arroba", false],
    ["a@b@unifei.edu.br", false],
    ["@unifei.edu.br", false],
  ])("%s → %s", (email, expected) => {
    expect(isAllowedEmail(email, D)).toBe(expected);
  });
});

describe("normalizeEmail", () => {
  it("apara e minusculiza", () => {
    expect(normalizeEmail(" Aluno@UNIFEI.edu.br ")).toBe("aluno@unifei.edu.br");
  });
});
