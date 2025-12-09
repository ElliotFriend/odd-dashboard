ALTER TABLE "repositories" ADD COLUMN "is_missing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "repositories_is_missing_idx" ON "repositories" USING btree ("is_missing");