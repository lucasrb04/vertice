CREATE TABLE "search_zero_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"term" varchar(120) NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "search_zero_results" ADD CONSTRAINT "search_zero_results_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "search_zero_results_unique_idx" ON "search_zero_results" USING btree ("institution_id","term","day");--> statement-breakpoint
CREATE INDEX "search_zero_results_day_idx" ON "search_zero_results" USING btree ("day");