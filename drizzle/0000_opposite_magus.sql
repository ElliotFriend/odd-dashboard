CREATE TABLE "agencies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agencies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agencies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "author_events" (
	"author_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	CONSTRAINT "author_events_author_id_event_id_pk" PRIMARY KEY("author_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "authors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"github_id" bigint,
	"username" text,
	"name" text,
	"email" text,
	"agency_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "commits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"repository_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"sha" text NOT NULL,
	"commit_date" timestamp with time zone NOT NULL,
	"branch" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commits_repository_sha_unique" UNIQUE("repository_id","sha")
);
--> statement-breakpoint
CREATE TABLE "ecosystems" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ecosystems_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"parent_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ecosystems_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"start_date" date,
	"end_date" date,
	"agency_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "repositories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"github_id" bigint NOT NULL,
	"full_name" text NOT NULL,
	"agency_id" integer,
	"is_fork" boolean DEFAULT false NOT NULL,
	"parent_repository_id" integer,
	"parent_full_name" text,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "repositories_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "repositories_full_name_unique" UNIQUE("full_name")
);
--> statement-breakpoint
CREATE TABLE "repository_ecosystems" (
	"repository_id" integer NOT NULL,
	"ecosystem_id" integer NOT NULL,
	CONSTRAINT "repository_ecosystems_repository_id_ecosystem_id_pk" PRIMARY KEY("repository_id","ecosystem_id")
);
--> statement-breakpoint
CREATE TABLE "repository_events" (
	"repository_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	CONSTRAINT "repository_events_repository_id_event_id_pk" PRIMARY KEY("repository_id","event_id")
);
--> statement-breakpoint
CREATE INDEX "author_events_author_id_idx" ON "author_events" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "author_events_event_id_idx" ON "author_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "authors_github_id_idx" ON "authors" USING btree ("github_id");--> statement-breakpoint
CREATE INDEX "authors_email_idx" ON "authors" USING btree ("email");--> statement-breakpoint
CREATE INDEX "authors_agency_id_idx" ON "authors" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "commits_repository_id_idx" ON "commits" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "commits_author_id_idx" ON "commits" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "commits_sha_idx" ON "commits" USING btree ("sha");--> statement-breakpoint
CREATE INDEX "commits_commit_date_idx" ON "commits" USING btree ("commit_date");--> statement-breakpoint
CREATE INDEX "commits_branch_idx" ON "commits" USING btree ("branch");--> statement-breakpoint
CREATE INDEX "commits_repository_commit_date_idx" ON "commits" USING btree ("repository_id","commit_date");--> statement-breakpoint
CREATE INDEX "ecosystems_parent_id_idx" ON "ecosystems" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "events_agency_id_idx" ON "events" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "repositories_agency_id_idx" ON "repositories" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "repositories_parent_repository_id_idx" ON "repositories" USING btree ("parent_repository_id");--> statement-breakpoint
CREATE INDEX "repositories_is_fork_idx" ON "repositories" USING btree ("is_fork");--> statement-breakpoint
CREATE INDEX "repository_ecosystems_repository_id_idx" ON "repository_ecosystems" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "repository_ecosystems_ecosystem_id_idx" ON "repository_ecosystems" USING btree ("ecosystem_id");--> statement-breakpoint
CREATE INDEX "repository_events_repository_id_idx" ON "repository_events" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "repository_events_event_id_idx" ON "repository_events" USING btree ("event_id");