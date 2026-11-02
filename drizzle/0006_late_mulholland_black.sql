CREATE TABLE "search_documents" (
	"opportunity_id" uuid PRIMARY KEY NOT NULL,
	"institution_id" uuid NOT NULL,
	"document" "tsvector" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_synonyms" (
	"institution_id" uuid NOT NULL,
	"term" varchar(64) NOT NULL,
	"canonical" varchar(64) NOT NULL,
	CONSTRAINT "search_synonyms_institution_id_term_canonical_pk" PRIMARY KEY("institution_id","term","canonical")
);
--> statement-breakpoint
CREATE TABLE "search_vocabulary" (
	"institution_id" uuid NOT NULL,
	"word" varchar(255) NOT NULL,
	"frequency" integer NOT NULL,
	CONSTRAINT "search_vocabulary_institution_id_word_pk" PRIMARY KEY("institution_id","word")
);
--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_synonyms" ADD CONSTRAINT "search_synonyms_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_vocabulary" ADD CONSTRAINT "search_vocabulary_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_documents_document_idx" ON "search_documents" USING gin ("document");