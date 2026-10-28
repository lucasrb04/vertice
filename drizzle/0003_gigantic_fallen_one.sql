ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_external_url_required";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "application_mode";--> statement-breakpoint
DROP TYPE "public"."application_mode";