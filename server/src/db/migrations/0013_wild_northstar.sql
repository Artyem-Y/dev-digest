CREATE TABLE "skill_project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pr_brief" ADD COLUMN "head_sha" text;--> statement-breakpoint
ALTER TABLE "pr_brief" ADD COLUMN "sources" jsonb;--> statement-breakpoint
ALTER TABLE "pr_brief" ADD COLUMN "telemetry" jsonb;--> statement-breakpoint
ALTER TABLE "skill_project_documents" ADD CONSTRAINT "skill_project_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_project_documents" ADD CONSTRAINT "skill_project_documents_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_project_documents" ADD CONSTRAINT "skill_project_documents_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_project_documents" ADD CONSTRAINT "agent_project_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_project_documents" ADD CONSTRAINT "agent_project_documents_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_project_documents" ADD CONSTRAINT "agent_project_documents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skill_project_documents_owner_path_uq" ON "skill_project_documents" USING btree ("repo_id","skill_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_project_documents_owner_path_uq" ON "agent_project_documents" USING btree ("repo_id","agent_id","path");