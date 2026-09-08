CREATE TABLE `meal_ingredients` (
	`id` integer PRIMARY KEY NOT NULL,
	`meal_id` integer NOT NULL,
	`name` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`inventory_item_id` integer,
	`estimated_price` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_meal_ingredients_meal_id` ON `meal_ingredients` (`meal_id`);--> statement-breakpoint
CREATE TABLE `meal_plans` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`planned_date` text NOT NULL,
	`planned_time` text,
	`notes` text,
	`thumbnail_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_meal_plans_planned_date` ON `meal_plans` (`planned_date`);