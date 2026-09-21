// One SQL statement keeps duplicate detection and insert together in D1.
export const AUTO_ADD_ESSENTIALS_SQL = `
  INSERT INTO shopping_items (household_id, name, quantity, unit, completed)
  SELECT e.household_id, e.name,
    CASE WHEN e.minimum_stock > COALESCE((
      SELECT SUM(i.quantity) FROM inventory_items i
      WHERE i.household_id = e.household_id
        AND COALESCE(i.normalized_name, lower(trim(i.name))) = e.normalized_name
        AND COALESCE(i.normalized_brand, lower(trim(COALESCE(i.brand, '')))) = e.normalized_brand
        AND lower(i.unit) = lower(e.unit)
    ), 0) THEN ROUND(e.minimum_stock - COALESCE((
      SELECT SUM(i.quantity) FROM inventory_items i
      WHERE i.household_id = e.household_id
        AND COALESCE(i.normalized_name, lower(trim(i.name))) = e.normalized_name
        AND COALESCE(i.normalized_brand, lower(trim(COALESCE(i.brand, '')))) = e.normalized_brand
        AND lower(i.unit) = lower(e.unit)
    ), 0), 3) ELSE 1 END,
    e.unit, 0
  FROM essential_items e
  JOIN household_settings h ON h.household_id = e.household_id
  WHERE e.household_id = ? AND h.auto_add_essentials = 1
    AND e.auto_add_to_shopping_list = 1
    AND COALESCE((
      SELECT SUM(i.quantity) FROM inventory_items i
      WHERE i.household_id = e.household_id
        AND COALESCE(i.normalized_name, lower(trim(i.name))) = e.normalized_name
        AND COALESCE(i.normalized_brand, lower(trim(COALESCE(i.brand, '')))) = e.normalized_brand
        AND lower(i.unit) = lower(e.unit)
    ), 0) <= e.minimum_stock
    AND NOT EXISTS (
      SELECT 1 FROM shopping_items s
      WHERE s.household_id = e.household_id AND s.completed = 0
        AND lower(trim(s.name)) = e.normalized_name
        AND lower(s.unit) = lower(e.unit)
    )
`;
