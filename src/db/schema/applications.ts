import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { applicationStatusEnum } from "./enums";
import { opportunities } from "./opportunities";
import { users } from "./users";

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("APPLIED"),
    answerText: text("answer_text"),
    externalProfileLink: varchar("external_profile_link", { length: 255 }),
    matchScoreSnapshot: integer("match_score_snapshot"), // Score 0-100 no momento da inscrição; nulo até existir o motor de match (D45)
    organizerFeedback: text("organizer_feedback"), // Mensagem enviada por e-mail ao mudar status
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("applications_opp_user_idx").on(t.opportunityId, t.userId)]
);

// Histórico de movimentações no Kanban (com a mensagem enviada por e-mail ao aluno)
export const applicationEvents = pgTable(
  "application_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: applicationStatusEnum("from_status"), // null no evento de criação
    toStatus: applicationStatusEnum("to_status").notNull(),
    message: text("message"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("application_events_app_idx").on(t.applicationId, t.createdAt)]
);

// Botão "Já me inscrevi neste edital" (vagas EXTERNAL) — aparece em "Minhas Candidaturas"
export const externalApplicationMarks = pgTable(
  "external_application_marks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("ext_marks_user_opp_idx").on(t.userId, t.opportunityId)]
);

// Deduplicação de cliques no edital externo. visitorHash = HMAC(segredo, IP + User-Agent);
// o IP bruto nunca é armazenado (LGPD). externalClicksCount só incrementa em inserção nova.
export const opportunityExternalClicks = pgTable(
  "opportunity_external_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    visitorHash: varchar("visitor_hash", { length: 64 }).notNull(),
    day: date("day").notNull(),
  },
  (t) => [uniqueIndex("ext_clicks_unique_idx").on(t.opportunityId, t.visitorHash, t.day)]
);
