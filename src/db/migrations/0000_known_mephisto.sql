CREATE TABLE `ability_ratings` (
	`module` text PRIMARY KEY NOT NULL,
	`elo` real NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`instrument` text NOT NULL,
	`raw_score` real NOT NULL,
	`normalized` real,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`payload` text,
	`created_at` integer NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cards_module_is_deleted_idx` ON `cards` (`module`,`is_deleted`);--> statement-breakpoint
CREATE TABLE `fsrs_state` (
	`card_id` text PRIMARY KEY NOT NULL,
	`due` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`reps` integer NOT NULL,
	`lapses` integer NOT NULL,
	`phase` text NOT NULL,
	`scheduled_days` integer NOT NULL,
	`learning_steps` integer NOT NULL,
	`last_review` integer,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fsrs_state_due_idx` ON `fsrs_state` (`due`);--> statement-breakpoint
CREATE TABLE `review_log` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`ts` integer NOT NULL,
	`rating` text NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`difficulty` real NOT NULL,
	`stability` real NOT NULL,
	`retrievability` real NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_log_card_id_idx` ON `review_log` (`card_id`);--> statement-breakpoint
CREATE INDEX `review_log_ts_idx` ON `review_log` (`ts`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`started` integer NOT NULL,
	`ended` integer,
	`module` text NOT NULL,
	`items` integer DEFAULT 0 NOT NULL,
	`accuracy` real DEFAULT 0 NOT NULL
);
