CREATE TYPE "public"."report_reason" AS ENUM('SPAM', 'FALSE_INFO', 'INAPPROPRIATE', 'OTHER');--> statement-breakpoint
DROP INDEX "reports_unique_idx";--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status_before_moderation" "project_status";--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "status_before_moderation" "opportunity_status";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reason_code" "report_reason" NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "reports_pending_target_idx" ON "reports" USING btree ("target_type","target_id") WHERE "reports"."resolved_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_unique_idx" ON "reports" USING btree ("reporter_user_id","target_type","target_id") WHERE "reports"."resolved_at" IS NULL;