CREATE TABLE `auth_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`blocked_until` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `household_invitations` (
	`id` integer PRIMARY KEY NOT NULL,
	`household_id` integer NOT NULL,
	`email` text NOT NULL,
	`normalized_email` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`invited_by_user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_household_invitations_token_hash` ON `household_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_household_invitations_household_email` ON `household_invitations` (`household_id`,`normalized_email`);--> statement-breakpoint
CREATE TABLE `household_memberships` (
	`id` integer PRIMARY KEY NOT NULL,
	`household_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_household_memberships_household_user` ON `household_memberships` (`household_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_household_memberships_user` ON `household_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_households_created_by` ON `households` (`created_by_user_id`);--> statement-breakpoint
CREATE TABLE `product_brands` (
	`id` integer PRIMARY KEY NOT NULL,
	`household_id` integer NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_brands_household_normalized` ON `product_brands` (`household_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`selected_household_id` integer,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`last_seen_at` text NOT NULL,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_active` ON `sessions` (`user_id`,`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`normalized_email` text NOT NULL,
	`display_name` text,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`password_changed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_normalized_email` ON `users` (`normalized_email`);--> statement-breakpoint
DROP INDEX `idx_product_categories_normalized_name`;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_categories_household_normalized_name` ON `product_categories` (`household_id`,`normalized_name`);--> statement-breakpoint
ALTER TABLE `expenses` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `household_settings` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `household_tasks` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `normalized_name` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `brand` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `normalized_brand` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `meal_ingredients` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `meal_plans` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `purchases` ADD `normalized_name` text;--> statement-breakpoint
ALTER TABLE `purchases` ADD `brand` text;--> statement-breakpoint
ALTER TABLE `purchases` ADD `normalized_brand` text;--> statement-breakpoint
ALTER TABLE `purchases` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `purchases` ADD `specific_spot` text;--> statement-breakpoint
ALTER TABLE `shopping_items` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `stock_changes` ADD `normalized_name` text;--> statement-breakpoint
ALTER TABLE `stock_changes` ADD `brand` text;--> statement-breakpoint
ALTER TABLE `stock_changes` ADD `normalized_brand` text;--> statement-breakpoint
ALTER TABLE `stock_changes` ADD `household_id` integer REFERENCES households(id);