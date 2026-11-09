const MINOR_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "a", "o"]);

/** O que vai no quadrado do projeto: a sigla, ou até três iniciais do nome sem as preposições. */
export function projectInitials(name: string, acronym: string | null): string {
  const trimmed = acronym?.trim();
  if (trimmed) return trimmed;
  const words = name
    .trim()
    .split(/[\s-]+/)
    .filter((w) => w && !MINOR_WORDS.has(w.toLocaleLowerCase("pt-BR")));
  return words
    .slice(0, 3)
    .map((w) => Array.from(w)[0]!)
    .join("")
    .toLocaleUpperCase("pt-BR");
}
