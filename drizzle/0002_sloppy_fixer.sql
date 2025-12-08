CREATE INDEX "authors_username_idx" ON "authors" USING btree ("username");--> statement-breakpoint
CREATE INDEX "commits_author_commit_date_idx" ON "commits" USING btree ("author_id","commit_date");