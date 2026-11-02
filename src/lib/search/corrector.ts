import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { searchSynonyms, searchVocabulary, tagAliases } from "@/db/schema";

const MIN_LETTERS = 4;
const MAX_LETTERS = 40; // Mesmo teto do vocabulário: acima disso não há candidato.
const MAX_TOKENS = 12;
const MIN_STEM = 3;

/** Mesma normalização do SQL (sem acentos, minúsculas), usada para o termo do usuário. */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export type QueryToken = {
  /** Como digitado, em minúsculas e com acentos: o stemmer precisa deles. */
  text: string;
  normalized: string;
  /** Sem pontuação de borda, com a caixa original. */
  raw: string;
  quoted: boolean;
  corrected: boolean;
};

const SENTENCE_EDGES = /^[,.;:!?()"]+|[,.;:!?()"]+$/g;

/** Um trecho entre aspas é um token só. Tokens repetidos saem, e o total é limitado. */
export function tokenize(q: string): QueryToken[] {
  const tokens = new Map<string, QueryToken>();
  const text = q.normalize("NFC").replace(/[“”]/g, '"');
  for (const m of text.matchAll(/"([^"]*)"|\S+/g)) {
    const quoted = m[1] !== undefined;
    const raw = (m[1] ?? m[0]).replace(SENTENCE_EDGES, "").trim();
    const normalized = normalizeQuery(raw);
    if (!normalized || tokens.has(normalized)) continue;
    if (tokens.size === MAX_TOKENS) break;
    tokens.set(normalized, { text: raw.toLowerCase(), normalized, raw, quoted, corrected: false });
  }
  return [...tokens.values()];
}

const SUFFIX = /^(.+?)(z?)inh([ao])(s?)$/;

/**
 * Formas sem diminutivo, da mais provável para a menos. O chamador aceita a primeira que existir no
 * vocabulário: uma forma inventada aqui nunca chega à busca.
 */
export function stripDiminutive(word: string): string[] {
  const m = SUFFIX.exec(normalizeQuery(word));
  if (!m) return [];
  const [, stem, z, vowel, plural] = m;
  const other = vowel === "a" ? "o" : "a";
  const singular: string[] = [];
  if (z) singular.push(stem);
  singular.push(`${stem}${z}${vowel}`, `${stem}${z}${other}`);
  const forms = plural ? [...singular, ...singular.map((f) => `${f}s`)] : singular;
  return [...new Set(forms)].filter((f) => f.length >= MIN_STEM && !(z === "" && stem.length < 2));
}

const isCorrectable = (t: QueryToken) => !t.quoted && /^\p{L}+$/u.test(t.text) && t.normalized.length >= MIN_LETTERS && t.normalized.length <= MAX_LETTERS;

/** Sinônimos curados da instituição. A tabela é curta e curada: vale ler inteira. */
export function loadSynonyms(institutionId: string) {
  return db
    .select({ term: searchSynonyms.term, canonical: searchSynonyms.canonical })
    .from(searchSynonyms)
    .where(eq(searchSynonyms.institutionId, institutionId));
}

async function unknownWords(institutionId: string, words: string[]): Promise<string[]> {
  const [vocabulary, synonyms, aliases] = await Promise.all([
    db
      .select({ word: searchVocabulary.word })
      .from(searchVocabulary)
      .where(and(eq(searchVocabulary.institutionId, institutionId), inArray(searchVocabulary.word, words))),
    loadSynonyms(institutionId),
    db
      .select({ slug: tagAliases.aliasSlug })
      .from(tagAliases)
      .where(and(eq(tagAliases.institutionId, institutionId), inArray(tagAliases.aliasSlug, words))),
  ]);
  const known = new Set([
    ...vocabulary.map((v) => v.word),
    ...synonyms.flatMap((s) => [...s.term.split(" "), ...s.canonical.split(" ")]),
    ...aliases.map((a) => a.slug),
  ]);
  return words.filter((w) => !known.has(w));
}

const stems = (word: string) => sql`ts_lexize('portuguese_stem', ${word}::text)`;
const stemmed = (word: string) => sql`numnode(plainto_tsquery('portuguese'::regconfig, ${word}::text))`;

/**
 * Stopword some da busca, e palavra com o radical de outra do catálogo já casa pelo stemmer
 * (`programar`, `bolsistas`): nos dois casos trocar a palavra só atrapalharia.
 */
async function isStopwordOrDerivation(institutionId: string, token: QueryToken): Promise<boolean> {
  const { text, normalized } = token;
  const { rows } = await db.execute<{ skip: boolean }>(sql`
    select ${stemmed(text)} = 0 or ${stemmed(normalized)} = 0 or exists (
      select 1 from search_vocabulary v
      where v.institution_id = ${institutionId}
        and ts_lexize('portuguese_stem', v.word) && (${stems(text)} || ${stems(normalized)})
    ) as skip
  `);
  return rows[0].skip;
}

async function undoDiminutive(institutionId: string, word: string): Promise<string | null> {
  const forms = stripDiminutive(word);
  if (!forms.length) return null;
  const rows = await db
    .select({ word: searchVocabulary.word })
    .from(searchVocabulary)
    .where(and(eq(searchVocabulary.institutionId, institutionId), inArray(searchVocabulary.word, forms)));
  const found = new Set(rows.map((r) => r.word));
  return forms.find((f) => found.has(f)) ?? null;
}

async function nearestWord(institutionId: string, word: string): Promise<string | null> {
  const distance = word.length === MIN_LETTERS ? 1 : 2;
  const edits = sql`levenshtein_less_equal(${searchVocabulary.word}, ${word}::text, ${distance}::int)`;
  const [row] = await db
    .select({ word: searchVocabulary.word })
    .from(searchVocabulary)
    .where(
      and(
        eq(searchVocabulary.institutionId, institutionId),
        sql`length(${searchVocabulary.word}) between ${word.length - distance}::int and ${word.length + distance}::int`,
        sql`${edits} <= ${distance}::int`,
        sql`numnode(plainto_tsquery('portuguese'::regconfig, ${searchVocabulary.word})) > 0`,
      ),
    )
    .orderBy(edits, sql`${searchVocabulary.frequency} desc`, searchVocabulary.word)
    .limit(1);
  return row?.word ?? null;
}

async function correctWord(institutionId: string, token: QueryToken): Promise<string | null> {
  if (await isStopwordOrDerivation(institutionId, token)) return null;
  return (await undoDiminutive(institutionId, token.normalized)) ?? (await nearestWord(institutionId, token.normalized));
}

function replaceWord(q: string, word: string, replacement: string): string {
  // `word` tem só letras: não precisa de escape.
  return q.replace(new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "gu"), replacement);
}

export type CorrectedQuery = {
  original: string;
  /** Consulta reescrita; `null` quando nenhuma palavra mudou. */
  corrected: string | null;
  terms: string[];
  tokens: QueryToken[];
};

/** Corrige palavra a palavra, só quem não existe no catálogo (spec §5.3). */
export async function correctQuery(institutionId: string, q: string): Promise<CorrectedQuery> {
  const tokens = tokenize(q);
  const candidates = tokens.filter(isCorrectable);
  const unknown = candidates.length
    ? new Set(await unknownWords(institutionId, candidates.map((t) => t.normalized)))
    : new Set<string>();

  let rewritten = q.normalize("NFC");
  let changed = false;
  const result: QueryToken[] = [];
  for (const token of tokens) {
    const fix = unknown.has(token.normalized) ? await correctWord(institutionId, token) : null;
    if (!fix) {
      result.push(token);
      continue;
    }
    changed = true;
    rewritten = replaceWord(rewritten, token.raw, fix);
    result.push({ ...token, text: fix, normalized: fix, corrected: true });
  }
  return { original: q, corrected: changed ? rewritten : null, terms: result.map((t) => t.text), tokens: result };
}
