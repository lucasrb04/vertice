import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAction } from "@/actions/result";
import { DomainError } from "@/lib/domain-errors";

const SECRET = "insert into users values ($1) params: maria@unifei.edu.br";

class DrizzleQueryError extends Error {
  constructor(cause: unknown) {
    super(SECRET, { cause });
    this.name = "DrizzleQueryError";
  }
}

describe("runAction: erro inesperado", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const failWith = (err: unknown) =>
    runAction(async () => {
      throw err;
    }).catch((e: unknown) => e);

  it("registra só nome e cause.code", async () => {
    await failWith(new DrizzleQueryError(Object.assign(new Error(SECRET), { code: "23503" })));
    expect(vi.mocked(console.error).mock.calls).toEqual([["[action] erro inesperado", "DrizzleQueryError", "23503"]]);
  });

  it("não leva a mensagem, os parâmetros nem a pilha ao log, e lança um erro genérico", async () => {
    const thrown = await failWith(new DrizzleQueryError(Object.assign(new Error(SECRET), { code: "23503" })));
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    for (const piece of ["maria", "params", "insert into", "at "]) expect(logged).not.toContain(piece);

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe("Erro inesperado na ação.");
    expect(error.cause).toBeUndefined();
    expect(error.stack).not.toContain("maria");
  });

  it("erro sem cause e valor que não é Error não quebram o log", async () => {
    await failWith(new TypeError(SECRET));
    await failWith(SECRET);
    await failWith(new DrizzleQueryError({ code: { texto: SECRET } }));
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ["[action] erro inesperado", "TypeError", undefined],
      ["[action] erro inesperado", "unknown", undefined],
      ["[action] erro inesperado", "DrizzleQueryError", undefined],
    ]);
  });

  it("redirect e notFound do Next passam intactos e sem log", async () => {
    const redirected = (await failWith(captured(() => redirect("/entrar")))) as { digest?: string };
    expect(redirected.digest).toMatch(/^NEXT_REDIRECT/);
    const missing = (await failWith(captured(() => notFound()))) as { digest?: string };
    expect(missing.digest).toMatch(/^NEXT_HTTP_ERROR_FALLBACK/);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("erro esperado continua virando ActionResult", async () => {
    const res = await runAction(async () => {
      throw new DomainError("HAS_APPLICATIONS", "Mensagem.");
    });
    expect(res).toEqual({ ok: false, error: "RULE", message: "Mensagem." });
    expect(console.error).not.toHaveBeenCalled();
  });
});

function captured(fn: () => never): unknown {
  try {
    return fn();
  } catch (err) {
    return err;
  }
}
