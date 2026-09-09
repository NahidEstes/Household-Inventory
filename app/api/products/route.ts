import { getDbBinding } from '@/db';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return Response.json([]);

  const escaped = query
    .toLowerCase()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
  const result = await getDbBinding()
    .prepare(
      `SELECT inventory_item_id AS inventoryItemId, name, category, unit,
              location, specific_spot AS specificSpot
       FROM (
         SELECT id AS inventory_item_id, name, category, unit, location,
                specific_spot, quantity, expiry_date, created_at,
                ROW_NUMBER() OVER (
                  PARTITION BY lower(trim(name))
                  ORDER BY CASE WHEN quantity > 0 THEN 0 ELSE 1 END,
                           CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
                           expiry_date ASC, created_at DESC
                ) AS product_rank
         FROM inventory_items
         WHERE lower(name) LIKE ? ESCAPE '\\'
       )
       WHERE product_rank = 1
       ORDER BY CASE WHEN lower(name) LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
                lower(name)
       LIMIT 8`,
    )
    .bind(`%${escaped}%`, `${escaped}%`)
    .all();

  return Response.json(result.results);
}
