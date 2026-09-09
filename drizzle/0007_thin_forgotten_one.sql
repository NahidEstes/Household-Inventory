CREATE TABLE `stock_changes` (
	`id` integer PRIMARY KEY NOT NULL,
	`inventory_item_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity_change` real NOT NULL,
	`quantity_before` real NOT NULL,
	`quantity_after` real NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_stock_changes_inventory_created` ON `stock_changes` (`inventory_item_id`,`created_at`);