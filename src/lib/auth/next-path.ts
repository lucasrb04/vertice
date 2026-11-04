/**
 * Destino pós-login vindo da query string. Só aceita caminho interno: começa com `/`, não com `//`
 * nem `/\` (o navegador os trata como outro host) e não leva barra invertida nem caractere de controle.
 */
export function safeNextPath(raw: string | undefined, fallback = "/painel"): string {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return fallback;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: recusar caracteres de controle é o objetivo da regex.
  if (raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}

/** Para onde o login volta em caso de erro, sem perder o destino. `next` já passou por `safeNextPath`. */
export function signInErrorPath(next: string): string {
  return `/entrar?next=${encodeURIComponent(next)}`;
}
