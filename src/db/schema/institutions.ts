import { boolean, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const institutions = pgTable("institutions", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(), // "unifei-itajuba"
  name: varchar("name", { length: 160 }).notNull(),         // "UNIFEI - Campus Itajubá"
  shortName: varchar("short_name", { length: 32 }).notNull(), // "UNIFEI"
  allowedEmailDomains: jsonb("allowed_email_domains").$type<string[]>().notNull().default(["unifei.edu.br"]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 16 }).notNull(),      // Ex: "CCO", "ECO", "SIN", "EME"
    name: varchar("name", { length: 120 }).notNull(),     // Ex: "Ciência da Computação"
    institute: varchar("institute", { length: 32 }).notNull(), // Ex: "IESTI", "IMC", "IEPG"
  },
  (t) => [uniqueIndex("courses_inst_code_idx").on(t.institutionId, t.code)]
);
