ALTER TABLE "skill_project_documents" ADD COLUMN "order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_project_documents" ADD COLUMN "order" integer DEFAULT 0 NOT NULL;