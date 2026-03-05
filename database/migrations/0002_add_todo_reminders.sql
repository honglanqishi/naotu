CREATE TABLE IF NOT EXISTS "todo_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mindmap_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"email" text NOT NULL,
	"title" text NOT NULL,
	"remind_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todo_reminders"
ADD CONSTRAINT "todo_reminders_mindmap_id_mindmaps_id_fk"
FOREIGN KEY ("mindmap_id") REFERENCES "public"."mindmaps"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "todo_reminders_remind_at_idx" ON "todo_reminders" USING btree ("remind_at");
--> statement-breakpoint
CREATE INDEX "todo_reminders_status_idx" ON "todo_reminders" USING btree ("status");