import { createElement, type ReactElement } from "react";
import { render } from "@react-email/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEnv, type Env } from "@/env";

const sendMock = vi.fn();
const batchMock = vi.fn();
const resendCtor = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
    batch = { send: batchMock };
    constructor(key: string) {
      resendCtor(key);
    }
  },
}));

import { sendEmail, sendEmailBatch } from "@/lib/email/send";
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

const msg = (react: ReactElement = createElement("p", null, "oi")) => ({ to: "aluno@unifei.edu.br", subject: "Assunto", react });

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

describe("limite do provedor", () => {
  const rateLimited = { data: null, error: { name: "rate_limit_exceeded", message: "aluno@unifei.edu.br", statusCode: 429 } };
  const accepted = { data: { id: "1" }, error: null };

  beforeEach(() => {
    sendMock.mockReset();
    batchMock.mockReset();
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Deixa a chamada pendente até o relógio falso andar 999 ms e confere que a segunda tentativa só vem aos 1000 ms. */
  async function expectRetryAfterOneSecond(mock: typeof sendMock, run: () => Promise<unknown>) {
    const pending = run();
    await vi.advanceTimersByTimeAsync(999);
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    return pending;
  }

  it("envio único tenta de novo uma vez depois de 1 s", async () => {
    sendMock.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(accepted);
    expect(await expectRetryAfterOneSecond(sendMock, () => sendEmail(msg(), withKey))).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });

  it("lote vai numa chamada só, cada um com seu destinatário, HTML e texto", async () => {
    batchMock.mockResolvedValue({ data: { data: [{ id: "1" }, { id: "2" }] }, error: null });
    const count = await sendEmailBatch([msg(), { ...msg(), to: "bia@unifei.edu.br" }], withKey);
    expect(count).toBe(2);
    expect(batchMock).toHaveBeenCalledTimes(1);
    expect(sendMock).not.toHaveBeenCalled();
    const [emails, options] = batchMock.mock.calls[0]!;
    expect(emails.map((e: { to: string }) => e.to)).toEqual(["aluno@unifei.edu.br", "bia@unifei.edu.br"]);
    expect(emails[0]).toMatchObject({ from: FROM, subject: "Assunto" });
    expect(emails[0].html).toContain("oi");
    expect(emails[0].text).toContain("oi");
    // Um endereço recusado não derruba os outros.
    expect(options).toMatchObject({ batchValidation: "permissive" });
  });

  it("lote limitado tenta de novo uma vez depois de 1 s, sem repetir além disso", async () => {
    batchMock.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce({ data: { data: [{ id: "1" }] }, error: null });
    expect(await expectRetryAfterOneSecond(batchMock, () => sendEmailBatch([msg()], withKey))).toBe(1);
    expect(batchMock).toHaveBeenCalledTimes(2);

    batchMock.mockClear();
    batchMock.mockResolvedValue(rateLimited);
    const failed = sendEmailBatch([msg()], withKey);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await failed).toBe(0);
    expect(batchMock).toHaveBeenCalledTimes(2);
    expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
  });

  it("outro erro não tenta de novo", async () => {
    batchMock.mockResolvedValue({ data: null, error: { name: "validation_error", message: "x", statusCode: 422 } });
    expect(await sendEmailBatch([msg()], withKey)).toBe(0);
    expect(batchMock).toHaveBeenCalledTimes(1);
  });

  it("recusa parcial e falha ao montar um e-mail não levam dados do aluno ao log e não barram os outros", async () => {
    const secret = "Maria Souza mensagem-secreta";
    const Broken = (): never => {
      throw new Error(secret);
    };
    batchMock.mockResolvedValue({
      data: { data: [{ id: "1" }], errors: [{ index: 1, message: `invalid ${secret}` }] },
      error: null,
    });
    const count = await sendEmailBatch(
      [
        { ...msg(createElement(Broken)), to: "maria@unifei.edu.br" },
        msg(),
        { ...msg(), to: "bia@unifei.edu.br" },
      ],
      withKey,
    );
    expect(count).toBe(1);
    expect(batchMock.mock.calls[0]![0].map((e: { to: string }) => e.to)).toEqual([
      "aluno@unifei.edu.br",
      "bia@unifei.edu.br",
    ]);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    for (const piece of ["Maria", "maria@", "mensagem-secreta", "aluno@"]) expect(logged).not.toContain(piece);
  });

  it("sem chave, ou sem nada para enviar, não chama a rede e avisa uma vez só", async () => {
    expect(await sendEmailBatch([], withKey)).toBe(0);
    expect(batchMock).not.toHaveBeenCalled();
    expect(await sendEmailBatch([msg(), msg()], noKey)).toBe(0);
    expect(batchMock).not.toHaveBeenCalled();
    expect(vi.mocked(console.info)).toHaveBeenCalledTimes(1);
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
