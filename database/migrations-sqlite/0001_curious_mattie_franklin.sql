CREATE TABLE `todo_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`mindmap_id` text NOT NULL,
	`node_id` text NOT NULL,
	`email` text NOT NULL,
	`title` text NOT NULL,
	`remind_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`mindmap_id`) REFERENCES `mindmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_reminders_remind_at_idx` ON `todo_reminders` (`remind_at`);--> statement-breakpoint
CREATE INDEX `todo_reminders_status_idx` ON `todo_reminders` (`status`);