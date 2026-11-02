import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { tagAliases, tags } from "@/db/schema";
import { correctQuery, loadSynonyms, normalizeQuery, tokenize, type QueryToken } from "./corrector";
import { normalizeTagSlug } from "./tags";

/** Uma palavra da consulta e o que vale por ela: basta casar uma das variantes. */
export type TermGroup = {
  /** Texto só de letras, ao FTS. Mais de uma palavra é expressão. */
  fts: string[];
  /** Texto normalizado ou com símbolo: o stemmer perderia `C++` e `100%`, então vai por LIKE. */
  like: string[];
  corrected: boolean;
};

export type SearchPlan = {
  original: string;
  corrected: string | null;
  groups: TermGroup[];
  /** Consulta como digitada, normalizada. Sempre vale por LIKE, mesmo sem nenhum termo. */
  literal: string;
  /** Consulta final, normalizada: o acerto exato da primeira camada. */
  phrase: string;
};

const isFtsText = (s: string) => /^[\p{L} ]+$/u.test(s);

function groupOf(token: QueryToken): TermGroup {
  const group: TermGroup = { fts: [], like: [], corrected: token.corrected };
  // Expressão entre aspas é texto exato. No FTS, a última palavra de uma forma do vetor fica colada à primeira da outra.
  if (token.quoted && token.text.includes(" ")) group.like.push(token.normalized);
  else addVariant(group, token.text);
  return group;
}

function addVariant(group: TermGroup, text: string) {
  const [list, value] = isFtsText(text) ? [group.fts, text] : [group.like, normalizeQuery(text)];
  if (!list.includes(value)) list.push(value);
}

async function loadStems(words: string[]): Promise<Map<string, string>> {
  const values = sql.join(words.map((w) => sql`(${w}::text)`), sql`, `);
  const { rows } = await db.execute<{ word: string; stem: string | null }>(sql`
    select v.word, (ts_lexize('portuguese_stem', v.word))[1] as stem from (values ${values}) as v(word)
  `);
  return new Map(rows.map((r) => [r.word, r.stem ?? r.word]));
}

/**
 * Sinônimos nos dois sentidos. Uma expressão vale inteira para cada uma de suas palavras. Palavra solta
 * casa pelo radical, para o plural valer como o singular cadastrado: `robos` como `robo`.
 */
async function addSynonyms(institutionId: string, tokens: QueryToken[], groups: TermGroup[]) {
  const pairs = await loadSynonyms(institutionId);
  const words = tokens.map((t) => (t.quoted ? "|" : t.normalized));
  if (!pairs.length || !words.length) return;
  const sentence = ` ${words.join(" ")} `;
  const stems = await loadStems([...new Set([...words, ...pairs.flatMap((p) => [p.term, p.canonical])])]);
  const sameStem = (a: string, b: string) => stems.get(a) === stems.get(b);

  for (const { term, canonical } of pairs) {
    for (const [from, to] of [[term, canonical], [canonical, term]]) {
      const fromWords = from.split(" ");
      words.forEach((w, i) => {
        const hit = fromWords.length > 1 ? fromWords.includes(w) && sentence.includes(` ${from} `) : w !== "|" && sameStem(w, from);
        if (hit) addVariant(groups[i], to);
      });
    }
  }
}

/** `tag_aliases`: slug da palavra, ou da consulta inteira, leva ao nome canônico da tag. */
async function addTagAliases(institutionId: string, tokens: QueryToken[], groups: TermGroup[]) {
  const open = tokens.flatMap((t, i) => (t.quoted ? [] : [{ i, slug: normalizeTagSlug(t.text) }])).filter((t) => t.slug);
  if (!open.length) return;
  const whole = normalizeTagSlug(tokens.filter((t) => !t.quoted).map((t) => t.text).join(" "));
  const rows = await db
    .select({ slug: tagAliases.aliasSlug, name: tags.name })
    .from(tagAliases)
    .innerJoin(tags, eq(tags.id, tagAliases.canonicalTagId))
    .where(and(eq(tagAliases.institutionId, institutionId), inArray(tagAliases.aliasSlug, [...new Set([whole, ...open.map((t) => t.slug)])])));
  for (const { slug, name } of rows) {
    for (const { i, slug: own } of open) {
      if (slug === own || slug === whole) addVariant(groups[i], name);
    }
  }
}

/** Devolve `null` quando `q` normaliza para vazio (sem busca). */
export async function planSearch(institutionId: string, q: string, opts: { exact: boolean }): Promise<SearchPlan | null> {
  const literal = normalizeQuery(q.replace(/["“”]/g, " ")).replace(/\s+/g, " ");
  if (!literal) return null;

  const { tokens, corrected } = opts.exact
    ? { tokens: tokenize(q), corrected: null }
    : await correctQuery(institutionId, q);

  // Uma palavra corrigida pode repetir outra da consulta.
  const distinct = tokens.filter((t, i) => tokens.findIndex((o) => o.normalized === t.normalized) === i);
  const groups = distinct.map(groupOf);
  await addSynonyms(institutionId, distinct, groups);
  await addTagAliases(institutionId, distinct, groups);

  return { original: q, corrected, groups, literal, phrase: distinct.map((t) => t.normalized).join(" ") || literal };
}

/**
 * Cada variante nas duas formas do índice (spec §5.1). O texto só chega ao Postgres como parâmetro de
 * `phraseto_tsquery`, que não interpreta operadores; stopword dá tsquery vazio, que não casa nem quebra.
 */
export function groupTsQuery(group: TermGroup): SQL {
  const parts = group.fts.flatMap((v) => [
    sql`phraseto_tsquery('portuguese'::regconfig, ${v}::text)`,
    sql`phraseto_tsquery('portuguese'::regconfig, unaccent(${v}::text))`,
  ]);
  return sql`(${sql.join(parts, sql` || `)})`;
}

const REGEX_META = /[.*+?^${}()|[\]\\]/g;

/** Regex de palavra completa, para texto já normalizado. Não usa `\y`: `C++` termina em símbolo. */
export function wholeWordRegex(text: string): string {
  return `(^|[^[:alnum:]])${text.replace(REGEX_META, "\\$&")}($|[^[:alnum:]])`;
}
