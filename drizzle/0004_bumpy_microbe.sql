ALTER TABLE "opportunities" ALTER COLUMN "deadline_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "acronym" varchar(20);--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "internal_selection_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "applications_open_on" date;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "interview_starts_on" date;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "interview_ends_on" date;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "result_on" date;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "activities_start_on" date;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "availability_requirement" varchar(200);--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "no_other_scholarship" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_has_channel" CHECK ("opportunities"."internal_selection_enabled" OR "opportunities"."external_url" IS NOT NULL);