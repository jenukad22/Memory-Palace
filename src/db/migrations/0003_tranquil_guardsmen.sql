CREATE TABLE `loci` (
	`id` text PRIMARY KEY NOT NULL,
	`palace_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`cue` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`palace_id`) REFERENCES `palaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `loci_palace_id_idx` ON `loci` (`palace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `loci_palace_position_unq` ON `loci` (`palace_id`,`position`);--> statement-breakpoint
CREATE TABLE `palaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL
);
