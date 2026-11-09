export type HighlightPart = { text: string; hit: boolean };

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

/**
 * Divide `text` nos trechos que casam com algum termo da busca (2+ letras), sem acento e sem caixa.
 * Compara por texto, não por expressão regular: `c++` ou `(` nunca viram padrão.
 */
export function highlightParts(text: string, q: string): HighlightPart[] {
  const terms = [...new Set(q.split(/\s+/).map(fold))].filter((t) => t.length >= 2);
  if (!text || terms.length === 0) return [{ text, hit: false }];

  // Texto dobrado com o índice do caractere original de cada posição.
  const chars = Array.from(text);
  let folded = "";
  const origin: number[] = [];
  chars.forEach((c, i) => {
    for (const f of fold(c)) {
      folded += f;
      origin.push(i);
    }
  });

  const hit = new Array<boolean>(chars.length).fill(false);
  for (const term of terms) {
    for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + 1)) {
      for (let k = at; k < at + term.length; k++) hit[origin[k]!] = true;
    }
  }

  const parts: HighlightPart[] = [];
  chars.forEach((c, i) => {
    const last = parts.at(-1);
    if (last && last.hit === hit[i]) last.text += c;
    else parts.push({ text: c, hit: hit[i]! });
  });
  return parts;
}
