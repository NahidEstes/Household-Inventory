import { and, eq } from 'drizzle-orm';
import { getDb, getDbBinding } from '@/db';
import { productCategories } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import { cleanCategoryName, normalizeCategoryName } from '@/lib/categories';

type CategoryRow = {
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
      `INSERT OR IGNORE INTO product_categories (name, normalized_name, household_id)
       SELECT MIN(trim(category)), lower(trim(category)), ?
       FROM inventory_items
       WHERE household_id = ? AND trim(category) <> ''
       GROUP BY lower(trim(category))`,
    )
    .bind(context.household.id, context.household.id)
    .run();

  return Response.json(await listCategories(context.household.id));
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const name = cleanCategoryName(body.name);
  const normalizedName = normalizeCategoryName(name);
  if (!name)
    return Response.json(
      { error: 'Category name is required.' },
      { status: 400 },
    );

  const db = getDb();
  const [duplicate] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.householdId, context.household.id),
        eq(productCategories.normalizedName, normalizedName),
      ),
    )
    .limit(1);
  if (duplicate)
    return Response.json(
      { error: 'A category with this name already exists.' },
      { status: 409 },
    );

  const [category] = await db
    .insert(productCategories)
    .values({ householdId: context.household.id, name, normalizedName })
    .returning();
  return Response.json({ ...category, itemCount: 0 }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const name = cleanCategoryName(body.name);
  const normalizedName = normalizeCategoryName(name);
  if (!Number.isInteger(id) || !name)
    return Response.json(
      { error: 'Please provide a valid category.' },
      { status: 400 },
    );

  const db = getDb();
  const [current] = await db
    .select()
    .from(productCategories)
    .where(
      and(
        eq(productCategories.id, id),
        eq(productCategories.householdId, context.household.id),
      ),
    )
    .limit(1);
  if (!current)
    return Response.json({ error: 'Category not found.' }, { status: 404 });
  const [duplicate] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.householdId, context.household.id),
        eq(productCategories.normalizedName, normalizedName),
      ),
    )
    .limit(1);
  if (duplicate && duplicate.id !== id)
    return Response.json(
      { error: 'A category with this name already exists.' },
      { status: 409 },
    );

  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'UPDATE product_categories SET name = ?, normalized_name = ? WHERE id = ? AND household_id = ?',
      )
      .bind(name, normalizedName, id, context.household.id),
    binding
      .prepare(
        'UPDATE inventory_items SET category = ? WHERE household_id = ? AND lower(trim(category)) = ?',
      )
      .bind(name, context.household.id, current.normalizedName),
    binding
      .prepare(
        'UPDATE purchases SET category = ? WHERE household_id = ? AND lower(trim(category)) = ?',
      )
      .bind(name, context.household.id, current.normalizedName),
  ]);

  const categories = await listCategories(context.household.id);
  return Response.json(categories.find((category) => category.id === id));
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid category ID is required.' },
      { status: 400 },
    );

  const categories = await listCategories(context.household.id);
  const category = categories.find((row) => row.id === id);
  if (!category)
    return Response.json({ error: 'Category not found.' }, { status: 404 });
  if (category.itemCount > 0)
    return Response.json(
      {
        error: `Move or rename the ${category.itemCount} linked ${category.itemCount === 1 ? 'item' : 'items'} before deleting this category.`,
        itemCount: category.itemCount,
      },
      { status: 409 },
    );

  await getDb()
    .delete(productCategories)
    .where(
      and(
        eq(productCategories.id, id),
        eq(productCategories.householdId, context.household.id),
      ),
    );
  return Response.json({ id });
}

async function listCategories(householdId: number) {
  const result = await getDbBinding()
    .prepare(
      `SELECT c.id, c.name, c.normalized_name AS normalizedName,
              c.created_at AS createdAt, COUNT(i.id) AS itemCount
       FROM product_categories c
       LEFT JOIN inventory_items i
         ON i.household_id = c.household_id
        AND lower(trim(i.category)) = c.normalized_name
       WHERE c.household_id = ?
       GROUP BY c.id, c.name, c.normalized_name, c.created_at
       ORDER BY c.name COLLATE NOCASE`,
    )
    .bind(householdId)
    .all<CategoryRow>();
  return result.results.map((row) => ({
    ...row,
    itemCount: Number(row.itemCount),
  }));
}
