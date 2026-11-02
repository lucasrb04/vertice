/**
 * Destino pós-login vindo da query string. Só aceita caminho interno: começa com `/`, não com `//`
 * nem `/\` (o navegador os trata como outro host) e não leva barra invertida nem caractere de controle.
 */
export function safeNextPath(raw: string | undefined, fallback = "/painel"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}
