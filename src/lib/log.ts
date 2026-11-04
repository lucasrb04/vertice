/**
 * Só contexto, nome e código: a mensagem e os parâmetros de um erro do Drizzle trazem dados pessoais,
 * e o objeto inteiro levaria a pilha junto. Nunca passe o erro direto ao `console.error`.
 */
export function logError(context: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "unknown";
  const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  console.error(context, name, typeof code === "string" ? code : undefined);
}
