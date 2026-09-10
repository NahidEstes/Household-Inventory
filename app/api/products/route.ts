import { getDbBinding } from '@/db';
import { requireApiContext } from '@/lib/auth';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return Response.json([]);

  const escaped = query
    .toLowerCase()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
  const result = await getDbBinding()
    .prepare(
      `SELECT inventory_item_id AS inventoryItemId, name, brand, category, unit,
              location, specific_spot AS specificSpot
       FROM (
         SELECT id AS inventory_item_id, name, normalized_name, brand,
                normalized_brand, category, unit, location, specific_spot,
                quantity, expiry_date, created_at,
                ROW_NUMBER() OVER (
                  PARTITION BY normalized_name, COALESCE(normalized_brand, '')
                  ORDER BY CASE WHEN quantity > 0 THEN 0 ELSE 1 END,
                           CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
                           expiry_date ASC, created_at DESC
                ) AS product_rank
         FROM inventory_items
         WHERE household_id = ? AND
               (normalized_name LIKE ? ESCAPE '\\' OR normalized_brand LIKE ? ESCAPE '\\')
       )
       WHERE product_rank = 1
       ORDER BY CASE WHEN normalized_name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
                normalized_name, normalized_brand
       LIMIT 8`,
    )
    .bind(context.household.id, `%${escaped}%`, `%${escaped}%`, `${escaped}%`)
    .all();

  return Response.json(result.results);
}
