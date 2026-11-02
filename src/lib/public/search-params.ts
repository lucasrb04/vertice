import { PROJECT_CATEGORIES } from "@/lib/validation/project";
import type { ProjectCategory } from "@/lib/projects/labels";

export const VITRINE_SORTS = ["relevance", "recent", "deadline", "popular"] as const;
export type VitrineSort = (typeof VITRINE_SORTS)[number];

export type VitrineParams = {
  q: string;
  categories: ProjectCategory[];
  scholarship: "PAID" | "VOLUNTARY" | null;
  course: string | null;
  tags: string[];
  includeClosed: boolean;
  sort: VitrineSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const MAX_Q = 100;
const MAX_TAGS = 10;
const MAX_PAGE = 10_000;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function all(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function defaultSort(q: string): VitrineSort {
  return q ? "relevance" : "recent";
}

/** Lê os parâmetros da URL; valores inválidos são ignorados, nunca lançam erro. */
export function parseVitrineParams(raw: RawParams): VitrineParams {
  const q = (first(raw.q) ?? "").trim().slice(0, MAX_Q).trim();

  const categories = [...new Set(all(raw.category))].filter((c): c is ProjectCategory =>
    (PROJECT_CATEGORIES as readonly string[]).includes(c),
  );

  const sch = first(raw.scholarship);
  const scholarship = sch === "PAID" || sch === "VOLUNTARY" ? sch : null;

  const courseRaw = (first(raw.course) ?? "").trim();
  const course = courseRaw && courseRaw.length <= 16 ? courseRaw : null;

  const tags = [
    ...new Set(
      (first(raw.tags) ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 64),
    ),
  ].slice(0, MAX_TAGS);

  const sortRaw = first(raw.sort);
  const sort = (VITRINE_SORTS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as VitrineSort)
    : defaultSort(q);

  const pageRaw = first(raw.page) ?? "";
  const pageNum = /^\d{1,5}$/.test(pageRaw) ? Number(pageRaw) : 1;
  const page = Math.min(Math.max(pageNum, 1), MAX_PAGE);

  return { q, categories, scholarship, course, tags, includeClosed: first(raw.encerrados) === "1", sort, page };
}

/** Monta o link de `/processos` omitindo padrões. Mudar qualquer filtro volta à página 1. */
export function vitrineHref(params: VitrineParams, overrides: Partial<VitrineParams> = {}): string {
  const p: VitrineParams = { ...params, ...overrides };
  if (!("page" in overrides)) p.page = 1;
  const parts: string[] = [];
  const add = (k: string, v: string) => parts.push(`${k}=${encodeURIComponent(v)}`);
  if (p.q) add("q", p.q);
  for (const c of p.categories) add("category", c);
  if (p.scholarship) add("scholarship", p.scholarship);
  if (p.course) add("course", p.course);
  if (p.tags.length) parts.push(`tags=${p.tags.map(encodeURIComponent).join(",")}`);
  if (p.includeClosed) add("encerrados", "1");
  if (p.sort !== defaultSort(p.q)) add("sort", p.sort);
  if (p.page > 1) add("page", String(p.page));
  return parts.length ? `/processos?${parts.join("&")}` : "/processos";
}
