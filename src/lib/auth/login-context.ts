const APPLY_PATH = /^\/processo\/([^/?#]+)\/candidatar(?:[?#]|$)/;

/** Slug do processo quando o login vem de "Candidatar-se"; o título é lido do banco, nunca da URL. */
export function applySlugFromNext(next: string): string | null {
  return APPLY_PATH.exec(next)?.[1] ?? null;
}

/**
 * Frase do `/entrar` que diz para quê se está entrando, a partir do `next` já validado. `opportunityTitle` só vem
 * de processo público; sem ele, a candidatura não ganha frase (não revela se o slug existe).
 */
export function loginContext(next: string, opportunityTitle: string | null): string | null {
  if (applySlugFromNext(next)) return opportunityTitle ? `Entre para se candidatar a ${opportunityTitle}.` : null;
  const path = next.split(/[?#]/)[0];
  if (path === "/publicar") {
    return "Entre para publicar o processo seletivo do seu projeto. Qualquer conta @unifei.edu.br publica, sem aprovação prévia.";
  }
  if (path === "/minhas-candidaturas") return "Entre para acompanhar suas candidaturas.";
  if (path.startsWith("/projetos/")) return "Entre para gerenciar o seu projeto.";
  return null;
}
