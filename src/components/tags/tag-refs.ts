import { normalizeTagSlug } from "@/lib/search/tags";
import type { TagRef } from "@/lib/validation/opportunity";

export function tagRefKey(ref: TagRef): string {
  return "id" in ref ? `id:${ref.id}` : `name:${normalizeTagSlug(ref.name)}`;
}

/** Slug usado para comparar tags escolhidas; tag existente sem nome conhecido só se compara pelo id. */
function refSlug(ref: TagRef, names: Record<string, string>): string | null {
  if ("name" in ref) return normalizeTagSlug(ref.name);
  const name = names[ref.id];
  return name ? normalizeTagSlug(name) : null;
}

/** Adiciona `ref` a `refs` sem repetir id nem slug normalizado e sem passar de `max`. */
export function addTagRef(refs: TagRef[], ref: TagRef, names: Record<string, string>, max: number): TagRef[] {
  if (refs.length >= max) return refs;
  const next: TagRef = "name" in ref ? { name: ref.name.trim() } : { id: ref.id };
  const slug = refSlug(next, names);
  if ("name" in next && !slug) return refs;
  const duplicate = refs.some(
    (r) => ("id" in r && "id" in next && r.id === next.id) || (slug !== null && refSlug(r, names) === slug),
  );
  return duplicate ? refs : [...refs, next];
}

export function removeTagRef(refs: TagRef[], key: string): TagRef[] {
  return refs.filter((r) => tagRefKey(r) !== key);
}
