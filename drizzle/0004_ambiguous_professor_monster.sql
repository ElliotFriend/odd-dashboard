ALTER TABLE "authors" ADD COLUMN "is_sdf_employee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "authors_is_sdf_employee_idx" ON "authors" USING btree ("is_sdf_employee");