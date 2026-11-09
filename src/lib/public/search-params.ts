import { z } from "zod";
import type { ProjectCategory } from "@/lib/projects/labels";
import { PROJECT_CATEGORIES } from "@/lib/validation/project";

export const VITRINE_SORTS = ["relevance", "recent", "deadline", "popular"] as const;
export type VitrineSort = (typeof VITRINE_SORTS)[number];

/** Abas da lista: todos os abertos, os que encerram em 7 dias e os que ainda vão abrir inscrições. */
export const VITRINE_SITUATIONS = ["", "encerrando", "em-breve"] as const;
export type VitrineSituation = (typeof VITRINE_SITUATIONS)[number];

export type VitrineParams = {
  q: string;
  categories: ProjectCategory[];
  scholarship: "PAID" | "VOLUNTARY" | null;
  course: string | null;
  tags: string[];
  includeClosed: boolean;
  sort: VitrineSort;
  page: number;
  /** `corrigir=0`: busca sem corrigir nenhuma palavra. */
  exact: boolean;
  /** `situacao=`: aba escolhida. */
  situation: VitrineSituation;
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

// Postgres rejeita \0 em texto (22021); removemos antes de qualquer validação.
const clean = (s: string) => s.replaceAll("\0", "");

const qSchema = z
  .string()
  .transform((s) => clean(s).trim().slice(0, MAX_Q).trim())
  .catch("");
const categorySchema = z.enum(PROJECT_CATEGORIES);
const scholarshipSchema = z.enum(["PAID", "VOLUNTARY"]).nullable().catch(null);
const courseSchema = z
  .string()
  .transform((s) => clean(s).trim())
  .pipe(z.string().min(1).max(16))
  .nullable()
  .catch(null);
const tagSlugSchema = z.string().min(1).max(64);
const sortSchema = z.enum(VITRINE_SORTS);
const situationSchema = z.enum(VITRINE_SITUATIONS).catch("");
const pageSchema = z
  .string()
  .regex(/^\d{1,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_PAGE))
  .catch(1);

/** Lê os parâmetros da URL; valores inválidos são ignorados, nunca lançam erro. */
export function parseVitrineParams(raw: RawParams): VitrineParams {
  const q = qSchema.parse(first(raw.q) ?? "");

  const categories = [
    ...new Set(
      all(raw.category).flatMap((c) => {
        const r = categorySchema.safeParse(c);
        return r.success ? [r.data] : [];
      }),
    ),
  ];

  const scholarship = scholarshipSchema.parse(first(raw.scholarship) ?? null);
  const course = courseSchema.parse(first(raw.course) ?? null);

  const tags = [
    ...new Set(
      all(raw.tags)
        .flatMap((v) => clean(v).split(","))
        .map((t) => t.trim().toLowerCase())
        .filter((t) => tagSlugSchema.safeParse(t).success),
    ),
  ].slice(0, MAX_TAGS);

  const sortParsed = sortSchema.safeParse(first(raw.sort));
  const sort = sortParsed.success ? sortParsed.data : defaultSort(q);

  const page = pageSchema.parse(first(raw.page) ?? "");

  return {
    q,
    categories,
    scholarship,
    course,
    tags,
    includeClosed: first(raw.encerrados) === "1",
    sort,
    page,
    exact: first(raw.corrigir) === "0",
    situation: situationSchema.parse(first(raw.situacao) ?? ""),
  };
}

/** Monta o link da lista (`/`) omitindo padrões. Mudar qualquer filtro volta à página 1. */
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
  if (p.exact) add("corrigir", "0");
  if (p.situation) add("situacao", p.situation);
  if (p.page > 1) add("page", String(p.page));
  return parts.length ? `/?${parts.join("&")}` : "/";
}
