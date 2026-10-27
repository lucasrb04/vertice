import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import {
  applicationModeEnum,
  opportunityStatusEnum,
  opportunityTagRelationEnum,
  scholarshipTypeEnum,
} from "./enums";
import { institutions } from "./institutions";
import { projects } from "./projects";
import { tags } from "./tags";

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 140 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    roleArea: varchar("role_area", { length: 80 }), // Ex: "Subsistema de Telemetria", "Pesquisa em Visão Computacional"
    applicationMode: applicationModeEnum("application_mode").notNull(),
    externalUrl: varchar("external_url", { length: 500 }), // Obrigatório (https) se applicationMode === "EXTERNAL" — Zod refine + CHECK no banco
    customQuestion: varchar("custom_question", { length: 280 }), // Pergunta rápida p/ applicationMode === "INTERNAL"
    scholarshipType: scholarshipTypeEnum("scholarship_type").notNull().default("VOLUNTARY"),
    fundingAgency: varchar("funding_agency", { length: 64 }), // Ex: "FAPEMIG", "CNPq", "PIBIC", "Sem Fomento"
    scholarshipValueCents: integer("scholarship_value_cents"), // Ex: 70000 (R$ 700,00)
    weeklyHours: integer("weekly_hours"), // Informativo (ex: 12h, 20h)
    vacanciesCount: integer("vacancies_count").default(1),
    targetCourseIds: jsonb("target_course_ids").$type<string[]>().notNull().default([]), // Vazio = Todos os cursos
    minSemester: integer("min_semester"),
    maxSemester: integer("max_semester"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    status: opportunityStatusEnum("status").notNull().default("OPEN"),
    viewsCount: integer("views_count").notNull().default(0),
    externalClicksCount: integer("external_clicks_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("opportunities_inst_slug_idx").on(t.institutionId, t.slug),
    index("opportunities_status_deadline_idx").on(t.institutionId, t.status, t.deadlineAt),
    check(
      "opportunities_external_url_required",
      sql`${t.applicationMode} <> 'EXTERNAL' OR ${t.externalUrl} IS NOT NULL`,
    ),
  ]
);

export const opportunityTags = pgTable(
  "opportunity_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    relationType: opportunityTagRelationEnum("relation_type").notNull(),
  },
  (t) => [uniqueIndex("opp_tags_unique_idx").on(t.opportunityId, t.tagId, t.relationType)]
);
