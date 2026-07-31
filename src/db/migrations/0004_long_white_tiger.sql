CREATE TABLE `ability_log` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`elo` real NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ability_log_module_ts_idx` ON `ability_log` (`module`,`ts`);