CREATE TABLE `essential_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`brand` text,
	`normalized_brand` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`minimum_stock` real NOT NULL,
	`minimum_stock_unit` text NOT NULL,
	`auto_add_to_shopping_list` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_essential_items_household_product_unit` ON `essential_items` (`household_id`,`normalized_name`,`normalized_brand`,`unit`);--> statement-breakpoint
ALTER TABLE `household_settings` ADD `auto_add_essentials` integer DEFAULT false NOT NULL;