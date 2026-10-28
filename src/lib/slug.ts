import { randomInt } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** `[a-z0-9-]`, sem acentos, hífens colapsados. Pode retornar `""`. */
export function slugify(input: string, maxLength: number): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export function randomSlugSuffix(): string {
  let out = "";
  for (let i = 0; i < 4; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function opportunitySlug(title: string, suffix?: string): string {
  return `${slugify(title, 130) || "processo"}-${suffix ?? randomSlugSuffix()}`;
}

export function projectSlugBase(name: string): string {
  return slugify(name, 90) || `projeto-${randomSlugSuffix()}`;
}
