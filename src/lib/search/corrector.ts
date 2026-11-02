import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { searchSynonyms, searchVocabulary, tagAliases } from "@/db/schema";

const MIN_LETTERS = 4;
const MAX_LETTERS = 40; // Mesmo teto do vocabulário: acima disso não há candidato.
const MAX_TOKENS = 12;
const MIN_STEM = 3;
const LONG_WORD = 6; // A partir daqui valem distância 2 e primeira letra diferente.

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

/** Um trecho entre aspas é um token só, distinto da mesma palavra fora delas. Repetidos saem, e o total é limitado. */
export function tokenize(q: string): QueryToken[] {
  const tokens = new Map<string, QueryToken>();
  const text = q.normalize("NFC").replace(/[“”]/g, '"');
  for (const m of text.matchAll(/"([^"]*)"|\S+/g)) {
    const quoted = m[1] !== undefined;
    const raw = (m[1] ?? m[0]).replace(SENTENCE_EDGES, "").trim();
    const normalized = normalizeQuery(raw);
    const key = `${quoted}:${normalized}`;
    if (!normalized || tokens.has(key)) continue;
    if (tokens.size === MAX_TOKENS) break;
    tokens.set(key, { text: raw.toLowerCase(), normalized, raw, quoted, corrected: false });
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
      .where(eq(tagAliases.institutionId, institutionId)),
  ]);
  const known = new Set([
    ...vocabulary.map((v) => v.word),
    ...synonyms.flatMap((s) => [...s.term.split(" "), ...s.canonical.split(" ")]),
    ...aliases.flatMap((a) => a.slug.split("-")),
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

const sortedLetters = (word: string) => [...word].sort().join("");

/** Sem a primeira letra e o limite curto, palavra real fora do catálogo viraria outra: `nasa -> casa`. */
function isPlausibleTypo(word: string, candidate: string, edits: number): boolean {
  if (word[0] !== candidate[0]) return edits === 1 && word.length >= LONG_WORD;
  if (word.length >= LONG_WORD || edits === 1) return true;
  return sortedLetters(word) === sortedLetters(candidate);
}

async function nearestWord(institutionId: string, word: string): Promise<string | null> {
  const distance = word.length === MIN_LETTERS ? 1 : 2;
  const edits = sql<number>`levenshtein_less_equal(${searchVocabulary.word}, ${word}::text, ${distance}::int)`;
  const rows = await db
    .select({ word: searchVocabulary.word, edits })
    .from(searchVocabulary)
    .where(
      and(
        eq(searchVocabulary.institutionId, institutionId),
        sql`length(${searchVocabulary.word}) between ${word.length - distance}::int and ${word.length + distance}::int`,
        sql`${edits} <= ${distance}::int`,
        sql`numnode(plainto_tsquery('portuguese'::regconfig, ${searchVocabulary.word})) > 0`,
      ),
    )
    .orderBy(edits, sql`${searchVocabulary.frequency} desc`, searchVocabulary.word);
  return rows.find((r) => isPlausibleTypo(word, r.word, r.edits))?.word ?? null;
}

async function correctWord(institutionId: string, token: QueryToken): Promise<string | null> {
  if (await isStopwordOrDerivation(institutionId, token)) return null;
  return (await undoDiminutive(institutionId, token.normalized)) ?? (await nearestWord(institutionId, token.normalized));
}

/** Reescreve a consulta como digitada: trechos entre aspas e tokens com símbolo ficam como estão. */
function rewrite(q: string, fixes: Map<string, string>): string {
  return q.replace(/"[^"]*"|“[^”]*”|\S+/g, (chunk) => {
    const word = chunk.replace(SENTENCE_EDGES, "");
    const fix = fixes.get(normalizeQuery(word));
    return fix && !/^["“]/.test(chunk) ? chunk.replace(word, fix) : chunk;
  });
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

  const fixes = new Map<string, string>();
  const result: QueryToken[] = [];
  for (const token of tokens) {
    const fix = !token.quoted && unknown.has(token.normalized) ? await correctWord(institutionId, token) : null;
    if (fix) fixes.set(token.normalized, fix);
    result.push(fix ? { ...token, text: fix, normalized: fix, corrected: true } : token);
  }
  return { original: q, corrected: fixes.size ? rewrite(q.normalize("NFC"), fixes) : null, terms: result.map((t) => t.text), tokens: result };
}
