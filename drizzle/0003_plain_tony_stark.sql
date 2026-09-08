ALTER TABLE `shopping_items` ADD `quantity` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_items` ADD `unit` text DEFAULT 'pcs' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_items` ADD `estimated_price` real;--> statement-breakpoint
ALTER TABLE `shopping_items` ADD `scheduled_date` text;--> statement-breakpoint
CREATE INDEX `idx_shopping_items_scheduled_date` ON `shopping_items` (`scheduled_date`);