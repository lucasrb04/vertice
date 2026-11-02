import { createElement } from "react";
import { render } from "@react-email/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEnv, type Env } from "@/env";

const sendMock = vi.fn();
const resendCtor = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
    constructor(key: string) {
      resendCtor(key);
    }
  },
}));

import { sendEmail } from "@/lib/email/send";
import { StatusChangedEmail } from "@/lib/email/templates/status-changed";

const base = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
};
const prod = {
  ...base,
  NODE_ENV: "production",
  TURNSTILE_SECRET_KEY: "s",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
  VISITOR_HASH_SECRET: "v".repeat(32),
};
const FROM = "Vértice <nao-responda@example.com>";
const withKey: Env = parseEnv({ ...base, RESEND_API_KEY: "re_fake", EMAIL_FROM: FROM });
const noKey: Env = parseEnv(base);

const msg = (react = createElement("p", null, "oi")) => ({ to: "aluno@unifei.edu.br", subject: "Assunto", react });

describe("env de e-mail", () => {
  it("produção sem RESEND_API_KEY ou EMAIL_FROM lança", () => {
    expect(() => parseEnv({ ...prod, EMAIL_FROM: FROM })).toThrow(/RESEND_API_KEY: obrigatório em produção/);
    expect(() => parseEnv({ ...prod, RESEND_API_KEY: "re_fake" })).toThrow(/EMAIL_FROM: obrigatório em produção/);
  });
  it("produção com as duas passa; fora de produção aceita sem elas", () => {
    expect(parseEnv({ ...prod, RESEND_API_KEY: "re_fake", EMAIL_FROM: FROM }).RESEND_API_KEY).toBe("re_fake");
    expect(parseEnv(base).RESEND_API_KEY).toBeUndefined();
    expect(parseEnv({ ...base, RESEND_API_KEY: "" }).RESEND_API_KEY).toBeUndefined();
  });
});

describe("sendEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    resendCtor.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("sem chave não chama a rede e devolve false", async () => {
    expect(await sendEmail(msg(), noKey)).toBe(false);
    expect(resendCtor).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("com chave envia HTML e texto pelo remetente configurado", async () => {
    sendMock.mockResolvedValue({ data: { id: "1" }, error: null });
    expect(await sendEmail(msg(), withKey)).toBe(true);
    expect(resendCtor).toHaveBeenCalledWith("re_fake");
    const arg = sendMock.mock.calls[0]![0];
    expect(arg).toMatchObject({ from: FROM, to: "aluno@unifei.edu.br", subject: "Assunto" });
    expect(arg.html).toContain("oi");
    expect(arg.text).toContain("oi");
  });

  it("erro devolvido ou lançado pelo provedor vira false, sem dados do aluno no log", async () => {
    const secret = "Maria Souza aluno@unifei.edu.br mensagem-secreta";
    const react = createElement("p", null, secret);
    sendMock.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: secret, statusCode: 422 } });
    expect(await sendEmail(msg(react), withKey)).toBe(false);
    sendMock.mockRejectedValueOnce(new Error(secret));
    expect(await sendEmail(msg(react), withKey)).toBe(false);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(vi.mocked(console.error)).toHaveBeenCalledTimes(2);
    for (const piece of ["Maria", "aluno@", "unifei.edu.br", "mensagem-secreta"]) expect(logged).not.toContain(piece);
  });
});

describe("StatusChangedEmail", () => {
  it("escapa HTML da mensagem", async () => {
    const html = await render(
      createElement(StatusChangedEmail, {
        studentName: "Ana",
        opportunityTitle: "IC",
        projectName: "Projeto",
        statusLabel: "Em análise",
        message: "<script>alert(1)</script>",
        url: "http://localhost:3000/minhas-candidaturas",
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Em análise");
  });
});
