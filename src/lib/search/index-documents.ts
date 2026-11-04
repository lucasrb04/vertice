import { eq, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { opportunities, projects, searchVocabulary } from "@/db/schema";
import { publicOpportunitySql } from "@/lib/public/queries";
import { logError } from "@/lib/log";
import { UNACCENTED_STOPWORDS } from "./corrector";

const tagNames = sql`(
  select string_agg(distinct t.name, ' ' order by t.name)
  from opportunity_tags ot join tags t on t.id = ot.tag_id
  where ot.opportunity_id = ${opportunities.id}
)`;

const concat = (...parts: unknown[]) => sql`concat_ws(' ', ${sql.join(parts.map((p) => sql`${p}`), sql`, `)})`;

/** Duas formas no vetor (spec §5.1): `unaccent` antes do stemmer sozinho quebra derivações. */
const weighted = (text: SQL, weight: "A" | "B" | "C") =>
  sql`setweight(to_tsvector('portuguese', ${text}) || to_tsvector('portuguese', unaccent(${text})), ${sql.raw(`'${weight}'`)})`;

const documentVector = sql`
  ${weighted(concat(opportunities.title, projects.acronym, tagNames), "A")}
  || ${weighted(concat(projects.name, opportunities.roleArea, projects.advisorName), "B")}
  || ${weighted(concat(opportunities.description), "C")}`;

async function upsertDocuments(tx: Tx, where: SQL): Promise<void> {
  await tx.execute(sql`
    insert into search_documents (opportunity_id, institution_id, document)
    select ${opportunities.id}, ${opportunities.institutionId}, ${documentVector}
    from ${opportunities} join ${projects} on ${projects.id} = ${opportunities.projectId}
    where ${where}
    on conflict (opportunity_id) do update
      set institution_id = excluded.institution_id, document = excluded.document, updated_at = now()
  `);
}

/**
 * Serializa as atualizações por projeto até o commit. Sem isso, editar o projeto e um processo dele
 * ao mesmo tempo deixa no índice o texto antigo de um dos dois. Cada comando depois da trava enxerga
 * o que a transação anterior gravou (READ COMMITTED). Ordem fixa: esta trava primeiro, depois as
 * linhas; quem escreve a pega no início da transação, para nunca esperar por ela segurando linha.
 */
const lockProjectDocuments = (projectId: SQL) => sql`pg_advisory_xact_lock(hashtext('search-documents:' || ${projectId}))`;

/** Abre a escrita de um projeto. Reentrante: os `refresh*` podem pegá-la de novo na mesma transação. */
export async function lockProjectSearchDocuments(tx: Tx, projectId: string): Promise<void> {
  await tx.execute(sql`select ${lockProjectDocuments(sql`${projectId}::text`)}`);
}

/** Reindexa um processo. Roda na transação da escrita, depois de gravar as tags. */
export async function refreshSearchDocument(tx: Tx, opportunityId: string): Promise<void> {
  await tx.execute(
    sql`select ${lockProjectDocuments(sql`${opportunities.projectId}::text`)} from ${opportunities} where ${opportunities.id} = ${opportunityId}`,
  );
  await upsertDocuments(tx, eq(opportunities.id, opportunityId));
}

/** Reindexa todos os processos do projeto: nome, sigla e orientador estão no documento deles. */
export async function refreshProjectSearchDocuments(tx: Tx, projectId: string): Promise<void> {
  await lockProjectSearchDocuments(tx, projectId);
  await upsertDocuments(tx, eq(opportunities.projectId, projectId));
}

/** Um projeto por transação, com a trava de cada um: pode rodar com o site no ar. */
export async function rebuildSearchDocuments(institutionId: string): Promise<void> {
  const rows = await db.select({ id: projects.id }).from(projects).where(eq(projects.institutionId, institutionId));
  for (const { id } of rows) {
    await db.transaction((tx) => refreshProjectSearchDocuments(tx, id));
  }
}

const vocabularyText = concat(
  opportunities.title,
  opportunities.roleArea,
  opportunities.description,
  projects.name,
  projects.acronym,
  projects.advisorName,
  tagNames,
);

/**
 * Refaz as palavras da instituição; `frequency` é o número de processos públicos com a palavra.
 * A stopword sai antes do `unaccent`, que tira dela o que o dicionário reconhece: `até` viraria `ate`.
 */
export async function rebuildSearchVocabulary(institutionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Quem espera a trava lê depois do commit do anterior: a última reconstrução vê a última escrita.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`search-vocabulary:${institutionId}`}))`);
    await tx.delete(searchVocabulary).where(eq(searchVocabulary.institutionId, institutionId));
    await tx.execute(sql`
      insert into search_vocabulary (institution_id, word, frequency)
      select ${institutionId}::uuid, n.word, count(distinct ${opportunities.id})::int
      from ${opportunities}
      join ${projects} on ${projects.id} = ${opportunities.projectId}
      cross join lateral unnest(to_tsvector('simple', ${vocabularyText})) as w(lexeme, positions, weights)
      cross join lateral (select unaccent(w.lexeme) as word) as n
      where ${opportunities.institutionId} = ${institutionId}
        and ${publicOpportunitySql()}
        and ts_lexize('portuguese_stem', w.lexeme) <> '{}'::text[]
        and n.word ~ '^[a-z]{3,40}$'
        and n.word not in ${UNACCENTED_STOPWORDS}
      group by n.word
    `);
  });
}

/** Roda depois do commit da escrita. Uma falha é só registrada: o vocabulário nunca bloqueia salvar. */
export async function scheduleVocabularyRebuild(institutionId: string): Promise<void> {
  try {
    await rebuildSearchVocabulary(institutionId);
  } catch (err) {
    logError("Falha ao reconstruir o vocabulário de busca:", err);
  }
}
