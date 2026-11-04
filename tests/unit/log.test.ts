import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/log";

const SECRET = "insert into users values ($1) params: maria@unifei.edu.br";

describe("logError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("registra contexto, nome e cause.code, sem a mensagem", () => {
    const err = new Error(SECRET, { cause: Object.assign(new Error(SECRET), { code: "23505" }) });
    err.name = "DrizzleQueryError";
    logError("[x] falha", err);
    expect(vi.mocked(console.error).mock.calls).toEqual([["[x] falha", "DrizzleQueryError", "23505"]]);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    for (const piece of ["maria", "params", "insert into"]) expect(logged).not.toContain(piece);
  });

  it("aceita valor que não é Error e causa sem código", () => {
    logError("[x] falha", "maria@unifei.edu.br");
    logError("[y] falha", new TypeError(SECRET));
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ["[x] falha", "unknown", undefined],
      ["[y] falha", "TypeError", undefined],
    ]);
  });
});
