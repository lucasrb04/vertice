import { boolean, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { projectCategoryEnum, projectMemberRoleEnum, projectStatusEnum } from "./enums";
import { institutions } from "./institutions";
import { users } from "./users";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    shortDescription: varchar("short_description", { length: 280 }).notNull(),
    description: text("description"),
    category: projectCategoryEnum("category").notNull(),
    institute: varchar("institute", { length: 32 }), // Ex: "IESTI", "IMC", "IEPG"
    advisorName: varchar("advisor_name", { length: 120 }), // Professor Orientador / Coordenador
    websiteUrl: varchar("website_url", { length: 255 }),
    instagramUrl: varchar("instagram_url", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    hasInstitutionalBadge: boolean("has_institutional_badge").notNull().default(false), // "Projeto verificado" — concedido manualmente pelo admin (D31)
    status: projectStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("projects_inst_slug_idx").on(t.institutionId, t.slug)]
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: projectMemberRoleEnum("role").notNull().default("OWNER"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("project_members_unique_idx").on(t.projectId, t.userId)]
);
