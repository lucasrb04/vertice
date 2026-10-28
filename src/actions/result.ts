import { NotFoundError, UnauthorizedError } from "@/lib/auth/errors";
import { TURNSTILE_FAILED, TurnstileFailedError } from "@/lib/security/turnstile";
import { DomainError, RateLimitError, ValidationError } from "@/lib/domain-errors";

export type ActionErrorCode = "UNAUTHORIZED" | "NOT_FOUND" | "VALIDATION" | "RATE_LIMITED" | "TURNSTILE_FAILED" | "RULE";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorCode; message: string; fieldErrors?: Record<string, string[]> };

/** Converte erros esperados em `ActionResult`; qualquer outro erro é relançado. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return { ok: false, error: "UNAUTHORIZED", message: "Sua sessão expirou. Entre de novo." };
    }
    if (err instanceof NotFoundError) return { ok: false, error: "NOT_FOUND", message: "Não encontrado." };
    if (err instanceof ValidationError) {
      return { ok: false, error: "VALIDATION", message: "Revise os campos destacados.", fieldErrors: err.fieldErrors };
    }
    if (err instanceof RateLimitError) return { ok: false, error: "RATE_LIMITED", message: err.userMessage };
    if (err instanceof DomainError) return { ok: false, error: "RULE", message: err.userMessage };
    if (err instanceof TurnstileFailedError) return { ok: false, error: "TURNSTILE_FAILED", message: TURNSTILE_FAILED };
    throw err;
  }
}
