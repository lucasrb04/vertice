import { customType, index, integer, pgTable, primaryKey, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { institutions } from "./institutions";
import { opportunities } from "./opportunities";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

// Índice de busca, uma linha por processo, inclusive os ocultos: a visibilidade fica nos predicados da consulta.
export const searchDocuments = pgTable(
  "search_documents",
  {
    opportunityId: uuid("opportunity_id")
      .primaryKey()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    document: tsvector("document").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("search_documents_document_idx").using("gin", t.document)],
);

// Palavras do corretor. Só de processos públicos: nunca pode revelar texto de processo oculto.
export const searchVocabulary = pgTable(
  "search_vocabulary",
  {
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    word: varchar("word", { length: 255 }).notNull(), // minúsculas, sem acentos, só letras, 3+ caracteres
    frequency: integer("frequency").notNull(), // Em quantos processos públicos a palavra aparece
  },
  (t) => [primaryKey({ columns: [t.institutionId, t.word] })],
);

// Sinônimos curados, em minúsculas e sem acentos. Um termo pode ter mais de um canônico.
export const searchSynonyms = pgTable(
  "search_synonyms",
  {
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 64 }).notNull(),
    canonical: varchar("canonical", { length: 64 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.institutionId, t.term, t.canonical] })],
);
