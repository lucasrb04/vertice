import {
  customType,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
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

// Buscas sem resultado, agregadas por termo e dia: nunca guarda usuário nem IP. Linhas com mais de
// 90 dias são apagadas a cada gravação (src/lib/search/zero-results.ts), pois não há agendador.
export const searchZeroResults = pgTable(
  "search_zero_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 120 }).notNull(), // normalizado: minúsculas, sem acentos
    day: date("day").notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [
    uniqueIndex("search_zero_results_unique_idx").on(t.institutionId, t.term, t.day),
    index("search_zero_results_day_idx").on(t.day),
  ],
);
