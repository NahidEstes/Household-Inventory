import { getDbBinding } from '@/db';
import { requireApiContext } from '@/lib/auth';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return Response.json([]);
  const escaped = query
    .toLocaleLowerCase('en-US')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
  const result = await getDbBinding()
    .prepare(
      `SELECT id, name
       FROM product_brands
       WHERE household_id = ? AND normalized_name LIKE ? ESCAPE '\\'
       ORDER BY CASE WHEN normalized_name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
                name COLLATE NOCASE
       LIMIT 8`,
    )
    .bind(context.household.id, `%${escaped}%`, `${escaped}%`)
    .all();
  return Response.json(result.results);
}
