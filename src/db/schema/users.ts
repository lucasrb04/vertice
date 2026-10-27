import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { careerGoalEnum, systemRoleEnum } from "./enums";
import { courses, institutions } from "./institutions";


// Tabela de usuário do Better-Auth (modelName "users" + additionalFields: institutionId,
// systemRole, isBanned). Só e-mails dos allowedEmailDomains da instituição se cadastram (D31).
// As tabelas sessions, accounts e verifications
// são geradas pelo CLI do Better-Auth e incluídas no schema Drizzle. Banir apaga as sessions.
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  systemRole: systemRoleEnum("system_role").notNull().default("USER"),
  isBanned: boolean("is_banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studentProfiles = pgTable("student_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  currentSemester: integer("current_semester"), // 1 a 12
  prefersPaidScholarship: boolean("prefers_paid_scholarship").notNull().default(false),
  preferredCategories: jsonb("preferred_categories").$type<string[]>().notNull().default([]),
  careerGoal: careerGoalEnum("career_goal"), // Não entra no score do MVP (D11)
  bio: text("bio"),
  githubUrl: varchar("github_url", { length: 255 }),
  linkedinUrl: varchar("linkedin_url", { length: 255 }),
  lattesUrl: varchar("lattes_url", { length: 255 }),
  portfolioUrl: varchar("portfolio_url", { length: 255 }),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  profileCompletionScore: integer("profile_completion_score").notNull().default(0), // 0 a 100
  emailAlertsEnabled: boolean("email_alerts_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

