import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { reportReasonEnum, reportTargetEnum } from "./enums";
import { institutions } from "./institutions";
import { users } from "./users";

// Denúncias da comunidade. 5 denúncias distintas -> alvo vai para UNDER_REVIEW + e-mail ao admin
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reasonCode: reportReasonEnum("reason_code").notNull(),
    reason: varchar("reason", { length: 500 }), // Descrição opcional de quem denuncia
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }), // Restaurar ou descartar resolve; nulo = pendente
  },
  (t) => [
    // Só entre pendentes: depois de resolvidas, novas denúncias começam do zero (spec §7).
    uniqueIndex("reports_unique_idx").on(t.reporterUserId, t.targetType, t.targetId).where(sql`${t.resolvedAt} IS NULL`),
    index("reports_pending_target_idx").on(t.targetType, t.targetId).where(sql`${t.resolvedAt} IS NULL`),
  ]
);
