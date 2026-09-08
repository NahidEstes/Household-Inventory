CREATE TABLE `purchases` (
	`id` integer PRIMARY KEY NOT NULL,
	`item_name` text NOT NULL,
	`category` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`total_price` real NOT NULL,
	`purchased_at` text NOT NULL,
	`expiry_date` text,
	`store` text,
	`location` text NOT NULL,
	`inventory_item_id` integer NOT NULL,
	`expense_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
