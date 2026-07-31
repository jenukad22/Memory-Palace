CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_outbox` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`queued_at` integer NOT NULL,
	PRIMARY KEY(`table_name`, `row_id`)
);
--> statement-breakpoint
ALTER TABLE `cards` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `cards_is_synced_idx` ON `cards` (`is_synced`);--> statement-breakpoint
ALTER TABLE `palaces` ADD `is_synced` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `palaces` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `is_synced` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `updated_at` integer DEFAULT 0 NOT NULL;