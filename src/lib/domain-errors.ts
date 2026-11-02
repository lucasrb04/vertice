import type { z } from "zod";

/** Entrada inválida. `fieldErrors` usa como chave o caminho do campo (`path.join(".")`). */
export class ValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    super("VALIDATION_ERROR");
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function fromZodError(err: z.ZodError): ValidationError {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return new ValidationError(fieldErrors);
}

/** Limite de uso excedido. `userMessage` é o texto pt-BR exibido ao usuário. */
export class RateLimitError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string) {
    super("RATE_LIMITED");
    this.name = "RateLimitError";
    this.userMessage = userMessage;
  }
}

export type DomainErrorCode =
  | "OPPORTUNITY_CLOSED"
  | "MEMBER_NO_ACCOUNT"
  | "OWNER_IMMUTABLE"
  | "ALREADY_MEMBER"
  | "HAS_APPLICATIONS"
  | "NOT_OPEN_YET"
  | "NO_INTERNAL_SELECTION"
  | "ALREADY_APPLIED"
  | "PROJECT_MEMBER";

/** Violação de regra de negócio, com mensagem pt-BR pronta para a UI. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly userMessage: string;

  constructor(code: DomainErrorCode, userMessage: string) {
    super(code);
    this.name = "DomainError";
    this.code = code;
    this.userMessage = userMessage;
  }
}
