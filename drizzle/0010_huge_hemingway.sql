CREATE INDEX `idx_expenses_household_spent` ON `expenses` (`household_id`,`spent_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_household_settings_household` ON `household_settings` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_household_tasks_household_due` ON `household_tasks` (`household_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_inventory_household_product` ON `inventory_items` (`household_id`,`normalized_name`,`normalized_brand`);--> statement-breakpoint
CREATE INDEX `idx_inventory_household_expiry` ON `inventory_items` (`household_id`,`expiry_date`);--> statement-breakpoint
CREATE INDEX `idx_meal_ingredients_household_meal` ON `meal_ingredients` (`household_id`,`meal_id`);--> statement-breakpoint
CREATE INDEX `idx_meal_plans_household_date` ON `meal_plans` (`household_id`,`planned_date`);--> statement-breakpoint
CREATE INDEX `idx_purchases_household_product_date` ON `purchases` (`household_id`,`normalized_name`,`normalized_brand`,`purchased_at`);--> statement-breakpoint
CREATE INDEX `idx_shopping_items_household_status_date` ON `shopping_items` (`household_id`,`completed`,`scheduled_date`);--> statement-breakpoint
CREATE INDEX `idx_stock_changes_household_created` ON `stock_changes` (`household_id`,`created_at`);