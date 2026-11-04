const MAX_TAG_SLUG_LENGTH = 64;

/**
 * Normaliza o texto de uma tag para um slug estável (ARCHITECTURE.md §6.1).
 * Retorna "" quando não sobra nenhum caractere válido.
 */
export function normalizeTagSlug(input: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9+#.-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.slice(0, MAX_TAG_SLUG_LENGTH).replace(/^-+|-+$/g, "");
}
