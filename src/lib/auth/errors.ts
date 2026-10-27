import { APIError } from "better-auth/api";

export const AUTH_ERROR_CODES = ["DOMAIN_NOT_ALLOWED", "EMAIL_NOT_VERIFIED", "ACCOUNT_SUSPENDED"] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** Recusa de política de acesso (D31/D32). O `code` chega à UI como `/entrar?error=<code>`. */
export class AuthPolicyError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = "AuthPolicyError";
    this.code = code;
  }
}

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === "string" && (AUTH_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Converte `AuthPolicyError` em `APIError` do Better-Auth. O callback OAuth redireciona para
 * `onAPIError.errorURL?error=<body.code>`, por isso o código vai em `body.code`.
 */
export function toAPIError(err: unknown): unknown {
  if (err instanceof AuthPolicyError) {
    return new APIError("FORBIDDEN", { code: err.code, message: err.code });
  }
  return err;
}

/** Inverso de `toAPIError`: recupera o `AuthPolicyError` de um erro vindo do Better-Auth. */
export function fromAPIError(err: unknown): unknown {
  if (err instanceof AuthPolicyError) return err;
  if (err instanceof APIError && isAuthErrorCode(err.body?.code)) {
    return new AuthPolicyError(err.body.code);
  }
  return err;
}

/** Sem sessão válida ou conta banida. Quem captura decide: redirecionar (páginas) ou 401 (ações). */
export class UnauthorizedError extends Error {
  readonly reason: "NO_SESSION" | "BANNED";

  constructor(reason: "NO_SESSION" | "BANNED") {
    super(reason);
    this.name = "UnauthorizedError";
    this.reason = reason;
  }
}

/** Recurso inexistente OU sem permissão: mesma classe e mensagem, para não vazar existência. */
export class NotFoundError extends Error {
  constructor() {
    super("NOT_FOUND");
    this.name = "NotFoundError";
  }
}
