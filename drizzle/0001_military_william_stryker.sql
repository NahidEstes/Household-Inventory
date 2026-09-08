CREATE TABLE `household_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`household_name` text DEFAULT 'My Household' NOT NULL,
	`monthly_budget` real DEFAULT 30000 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
