import { boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import {
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
    internalSelectionEnabled: boolean("internal_selection_enabled").notNull().default(false), // Seleção pela plataforma (D34)
    externalUrl: varchar("external_url", { length: 500 }), // Opcional; https validado no Zod — D34
    customQuestion: varchar("custom_question", { length: 280 }), // Pergunta rápida p/ seleção pela plataforma
    scholarshipType: scholarshipTypeEnum("scholarship_type").notNull().default("VOLUNTARY"),
    fundingAgency: varchar("funding_agency", { length: 64 }), // Ex: "FAPEMIG", "CNPq", "PIBIC", "Sem Fomento"
    scholarshipValueCents: integer("scholarship_value_cents"), // Ex: 70000 (R$ 700,00)
    weeklyHours: integer("weekly_hours"), // Informativo (ex: 12h, 20h)
    vacanciesCount: integer("vacancies_count").default(1),
    targetCourseIds: jsonb("target_course_ids").$type<string[]>().notNull().default([]), // Vazio = Todos os cursos
    minSemester: integer("min_semester"),
    maxSemester: integer("max_semester"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    applicationsOpenOn: date("applications_open_on", { mode: "string" }),
    interviewStartsOn: date("interview_starts_on", { mode: "string" }),
    interviewEndsOn: date("interview_ends_on", { mode: "string" }),
    resultOn: date("result_on", { mode: "string" }),
    activitiesStartOn: date("activities_start_on", { mode: "string" }),
    availabilityRequirement: varchar("availability_requirement", { length: 200 }),
    noOtherScholarship: boolean("no_other_scholarship").notNull().default(false),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    status: opportunityStatusEnum("status").notNull().default("OPEN"),
    statusBeforeModeration: opportunityStatusEnum("status_before_moderation"), // Restaurar volta a ele; nulo fora da moderação
    viewsCount: integer("views_count").notNull().default(0),
    externalClicksCount: integer("external_clicks_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("opportunities_inst_slug_idx").on(t.institutionId, t.slug),
    check("opportunities_has_channel", sql`${t.internalSelectionEnabled} OR ${t.externalUrl} IS NOT NULL`),
    index("opportunities_status_deadline_idx").on(t.institutionId, t.status, t.deadlineAt),
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
