-- Idempotent one-time backfill for data created before multi-household support.
-- Run only after the auth/household schema migrations have been applied.

INSERT OR IGNORE INTO households (id, name, created_at)
VALUES (
  1,
  COALESCE((SELECT household_name FROM household_settings ORDER BY id LIMIT 1), 'My Household'),
  CURRENT_TIMESTAMP
);

UPDATE inventory_items
SET household_id = 1,
    normalized_name = lower(trim(name)),
    normalized_brand = CASE WHEN trim(COALESCE(brand, '')) = '' THEN NULL ELSE lower(trim(brand)) END
WHERE household_id IS NULL;

DELETE FROM product_categories
WHERE household_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM product_categories scoped
    WHERE scoped.household_id = 1
      AND scoped.normalized_name = product_categories.normalized_name
  );
UPDATE product_categories SET household_id = 1 WHERE household_id IS NULL;
UPDATE stock_changes
SET household_id = 1,
    normalized_name = lower(trim(item_name)),
    normalized_brand = CASE WHEN trim(COALESCE(brand, '')) = '' THEN NULL ELSE lower(trim(brand)) END
WHERE household_id IS NULL;
UPDATE expenses SET household_id = 1 WHERE household_id IS NULL;
UPDATE purchases
SET household_id = 1,
    normalized_name = lower(trim(item_name)),
    normalized_brand = CASE WHEN trim(COALESCE(brand, '')) = '' THEN NULL ELSE lower(trim(brand)) END
WHERE household_id IS NULL;
UPDATE shopping_items SET household_id = 1 WHERE household_id IS NULL;
UPDATE meal_plans SET household_id = 1 WHERE household_id IS NULL;
UPDATE meal_ingredients SET household_id = 1 WHERE household_id IS NULL;
UPDATE household_tasks SET household_id = 1 WHERE household_id IS NULL;
UPDATE household_settings
SET household_id = 1
WHERE household_id IS NULL
  AND id = (SELECT MIN(id) FROM household_settings WHERE household_id IS NULL);

INSERT OR IGNORE INTO product_brands (id, household_id, name, normalized_name, created_at)
SELECT 1000000000 + row_number() OVER (ORDER BY normalized_brand),
       1,
       MIN(brand),
       normalized_brand,
       CURRENT_TIMESTAMP
FROM (
  SELECT brand, normalized_brand FROM inventory_items WHERE household_id = 1
  UNION ALL
  SELECT brand, normalized_brand FROM purchases WHERE household_id = 1
)
WHERE normalized_brand IS NOT NULL
GROUP BY normalized_brand;
