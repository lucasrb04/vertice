import { boolean, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { studentTagRelationEnum, tagCategoryEnum } from "./enums";
import { institutions } from "./institutions";
import { users } from "./users";

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),             // Nome de exibição: "Python", "Visão Computacional"
    normalizedSlug: varchar("normalized_slug", { length: 64 }).notNull(), // "python", "visao-computacional"
    category: tagCategoryEnum("category").notNull().default("TOPIC"),
    isVerified: boolean("is_verified").notNull().default(false), // Tags oficiais do seed ou aprovadas pelo Admin
    usageCount: integer("usage_count").notNull().default(0),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tags_inst_slug_idx").on(t.institutionId, t.normalizedSlug),
    index("tags_name_idx").on(t.name),
  ]
);

// Armazena sinônimos/erros de digitação mesclados pelo Admin (ex: "pyhton" -> tagId de "python")
export const tagAliases = pgTable(
  "tag_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    aliasSlug: varchar("alias_slug", { length: 64 }).notNull(),
    canonicalTagId: uuid("canonical_tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("tag_aliases_inst_slug_idx").on(t.institutionId, t.aliasSlug)]
);

export const studentTags = pgTable(
  "student_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    relationType: studentTagRelationEnum("relation_type").notNull(),
    proficiencyLevel: integer("proficiency_level").notNull().default(1), // 1: Iniciante, 2: Intermediário, 3: Avançado
  },
  (t) => [uniqueIndex("student_tags_unique_idx").on(t.userId, t.tagId, t.relationType)]
);
