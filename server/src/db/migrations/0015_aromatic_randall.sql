UPDATE "pr_brief"
SET "json" = jsonb_build_object(
  'brief', CASE WHEN jsonb_typeof("json") = 'object' AND NOT ("json" ? 'head_sha') AND "head_sha" IS NOT NULL
    THEN "json" || jsonb_build_object('head_sha', "head_sha") ELSE "json" END,
  'sources', COALESCE("sources", '[]'::jsonb),
  'telemetry', "telemetry",
  'previous_head_sha', "head_sha"
);--> statement-breakpoint
ALTER TABLE "pr_brief" DROP COLUMN "head_sha";--> statement-breakpoint
ALTER TABLE "pr_brief" DROP COLUMN "sources";--> statement-breakpoint
ALTER TABLE "pr_brief" DROP COLUMN "telemetry";
