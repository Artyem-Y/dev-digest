CREATE TABLE "onboarding_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"usage" jsonb NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "onboarding" ADD COLUMN "source_revision" text;--> statement-breakpoint
ALTER TABLE "onboarding" ADD COLUMN "index_revision" text;--> statement-breakpoint
ALTER TABLE "onboarding_attempts" ADD CONSTRAINT "onboarding_attempts_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_attempts_active_repo_uq" ON "onboarding_attempts" USING btree ("repo_id") WHERE "onboarding_attempts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "onboarding_attempts_repo_created_idx" ON "onboarding_attempts" USING btree ("repo_id","created_at");