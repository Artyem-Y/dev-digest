ALTER TABLE "pr_intent" ADD COLUMN "confidence" text;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "evidence" jsonb;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "source_fingerprint" text;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "model_provider" text;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "derived_at" timestamp with time zone;
