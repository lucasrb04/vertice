import { highlightParts } from "@/lib/public/highlight";

/** Texto com os termos da busca realçados em `<mark>`. */
export function Highlighted({ text, q }: { text: string; q?: string }) {
  if (!q) return text;
  return highlightParts(text, q).map((part, i) =>
    part.hit ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: pedaços fixos de um texto, sem reordenar.
      <mark key={i} className="rounded-[3px] bg-ipe-soft px-px text-inherit">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
