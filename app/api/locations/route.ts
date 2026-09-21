import { and, eq } from 'drizzle-orm';
import { getDb, getDbBinding } from '@/db';
import { productLocations } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import { cleanLocationName, normalizeLocationName } from '@/lib/locations';

type LocationRow = {
  id: number;
  name: string;
  normalizedName: string;
  createdAt: string;
  itemCount: number;
};

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const binding = getDbBinding();
  await binding
    .prepare(
      `INSERT OR IGNORE INTO product_locations (name, normalized_name, household_id)
       SELECT MIN(trim(location)), lower(trim(location)), ?
       FROM inventory_items
       WHERE household_id = ? AND trim(location) <> ''
       GROUP BY lower(trim(location))`,
    )
    .bind(context.household.id, context.household.id)
    .run();

  return Response.json(await listLocations(context.household.id));
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const name = cleanLocationName(body.name);
  const normalizedName = normalizeLocationName(name);
  if (!name)
    return Response.json(
      { error: 'Location name is required.' },
      { status: 400 },
    );

  const db = getDb();
  const [duplicate] = await db
    .select({ id: productLocations.id })
    .from(productLocations)
    .where(
      and(
        eq(productLocations.householdId, context.household.id),
        eq(productLocations.normalizedName, normalizedName),
      ),
    )
    .limit(1);
  if (duplicate)
    return Response.json(
      { error: 'A location with this name already exists.' },
      { status: 409 },
    );

  const [location] = await db
    .insert(productLocations)
    .values({ householdId: context.household.id, name, normalizedName })
    .returning();
  return Response.json({ ...location, itemCount: 0 }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const name = cleanLocationName(body.name);
  const normalizedName = normalizeLocationName(name);
  if (!Number.isInteger(id) || !name)
    return Response.json(
      { error: 'Please provide a valid location.' },
      { status: 400 },
    );

  const db = getDb();
  const [current] = await db
    .select()
    .from(productLocations)
    .where(
      and(
        eq(productLocations.id, id),
        eq(productLocations.householdId, context.household.id),
      ),
    )
    .limit(1);
  if (!current)
    return Response.json({ error: 'Location not found.' }, { status: 404 });
  const [duplicate] = await db
    .select({ id: productLocations.id })
    .from(productLocations)
    .where(
      and(
        eq(productLocations.householdId, context.household.id),
        eq(productLocations.normalizedName, normalizedName),
      ),
    )
    .limit(1);
  if (duplicate && duplicate.id !== id)
    return Response.json(
      { error: 'A location with this name already exists.' },
      { status: 409 },
    );

  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'UPDATE product_locations SET name = ?, normalized_name = ? WHERE id = ? AND household_id = ?',
      )
      .bind(name, normalizedName, id, context.household.id),
    binding
      .prepare(
        'UPDATE inventory_items SET location = ? WHERE household_id = ? AND lower(trim(location)) = ?',
      )
      .bind(name, context.household.id, current.normalizedName),
    binding
      .prepare(
        'UPDATE purchases SET location = ? WHERE household_id = ? AND lower(trim(location)) = ?',
      )
      .bind(name, context.household.id, current.normalizedName),
  ]);

  const locations = await listLocations(context.household.id);
  return Response.json(locations.find((location) => location.id === id));
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid location ID is required.' },
      { status: 400 },
    );

  const locations = await listLocations(context.household.id);
  const location = locations.find((row) => row.id === id);
  if (!location)
    return Response.json({ error: 'Location not found.' }, { status: 404 });
  if (location.itemCount > 0)
    return Response.json(
      {
        error: `Move or rename the ${location.itemCount} linked ${location.itemCount === 1 ? 'item' : 'items'} before deleting this location.`,
        itemCount: location.itemCount,
      },
      { status: 409 },
    );

  await getDb()
    .delete(productLocations)
    .where(
      and(
        eq(productLocations.id, id),
        eq(productLocations.householdId, context.household.id),
      ),
    );
  return Response.json({ id });
}

async function listLocations(householdId: number) {
  const result = await getDbBinding()
    .prepare(
      `SELECT l.id, l.name, l.normalized_name AS normalizedName,
              l.created_at AS createdAt, COUNT(i.id) AS itemCount
       FROM product_locations l
       LEFT JOIN inventory_items i
         ON i.household_id = l.household_id
        AND lower(trim(i.location)) = l.normalized_name
       WHERE l.household_id = ?
       GROUP BY l.id, l.name, l.normalized_name, l.created_at
       ORDER BY l.name COLLATE NOCASE`,
    )
    .bind(householdId)
    .all<LocationRow>();
  return result.results.map((row) => ({
    ...row,
    itemCount: Number(row.itemCount),
  }));
}
