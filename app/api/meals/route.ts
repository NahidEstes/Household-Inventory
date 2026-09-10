import { and, asc, eq } from 'drizzle-orm';
import { getDb, getDbBinding } from '@/db';
import { inventoryItems, mealIngredients, mealPlans } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';

type IngredientInput = {
  name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  inventoryItemId?: unknown;
  estimatedPrice?: unknown;
};

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const db = getDb();
  const [meals, ingredients, inventory] = await Promise.all([
    db
      .select()
      .from(mealPlans)
      .where(eq(mealPlans.householdId, context.household.id))
      .orderBy(asc(mealPlans.plannedDate), asc(mealPlans.plannedTime)),
    db
      .select()
      .from(mealIngredients)
      .where(eq(mealIngredients.householdId, context.household.id))
      .orderBy(asc(mealIngredients.id)),
    db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.householdId, context.household.id)),
  ]);
  const stock = new Map(inventory.map((item) => [item.id, item]));
  return Response.json(
    meals.map((meal) => ({
      ...meal,
      ingredients: ingredients
        .filter((ingredient) => ingredient.mealId === meal.id)
        .map((ingredient) => {
          const linked = ingredient.inventoryItemId
            ? stock.get(ingredient.inventoryItemId)
            : undefined;
          return {
            ...ingredient,
            inventoryName: linked?.name ?? null,
            inStock: Boolean(linked && linked.quantity >= ingredient.quantity),
          };
        }),
    })),
  );
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseMeal(body);
  if ('error' in parsed) return Response.json(parsed, { status: 400 });
  if (!(await validIngredientLinks(parsed.ingredients, context.household.id)))
    return Response.json(
      { error: 'An ingredient links to unavailable inventory.' },
      { status: 400 },
    );
  const mealId = recordId();
  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'INSERT INTO meal_plans (id, household_id, name, planned_date, planned_time, notes, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        mealId,
        context.household.id,
        parsed.name,
        parsed.plannedDate,
        parsed.plannedTime,
        parsed.notes,
        parsed.thumbnailUrl,
      ),
    ...parsed.ingredients.map((ingredient) =>
      binding
        .prepare(
          'INSERT INTO meal_ingredients (id, household_id, meal_id, name, quantity, unit, inventory_item_id, estimated_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          recordId(),
          context.household.id,
          mealId,
          ingredient.name,
          ingredient.quantity,
          ingredient.unit,
          ingredient.inventoryItemId,
          ingredient.estimatedPrice,
        ),
    ),
  ]);
  return Response.json({ id: mealId }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const parsed = parseMeal(body);
  if (!Number.isInteger(id) || 'error' in parsed)
    return Response.json(
      'error' in parsed ? parsed : { error: 'A valid meal ID is required.' },
      { status: 400 },
    );
  if (!(await validIngredientLinks(parsed.ingredients, context.household.id)))
    return Response.json(
      { error: 'An ingredient links to unavailable inventory.' },
      { status: 400 },
    );
  const exists = await getDb()
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(
      and(
        eq(mealPlans.id, id),
        eq(mealPlans.householdId, context.household.id),
      ),
    );
  if (!exists.length)
    return Response.json({ error: 'Meal not found.' }, { status: 404 });
  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'UPDATE meal_plans SET name = ?, planned_date = ?, planned_time = ?, notes = ?, thumbnail_url = ? WHERE id = ? AND household_id = ?',
      )
      .bind(
        parsed.name,
        parsed.plannedDate,
        parsed.plannedTime,
        parsed.notes,
        parsed.thumbnailUrl,
        id,
        context.household.id,
      ),
    binding
      .prepare(
        'DELETE FROM meal_ingredients WHERE meal_id = ? AND household_id = ?',
      )
      .bind(id, context.household.id),
    ...parsed.ingredients.map((ingredient) =>
      binding
        .prepare(
          'INSERT INTO meal_ingredients (id, household_id, meal_id, name, quantity, unit, inventory_item_id, estimated_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          recordId(),
          context.household.id,
          id,
          ingredient.name,
          ingredient.quantity,
          ingredient.unit,
          ingredient.inventoryItemId,
          ingredient.estimatedPrice,
        ),
    ),
  ]);
  return Response.json({ id });
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid meal ID is required.' },
      { status: 400 },
    );
  const exists = await getDb()
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(
      and(
        eq(mealPlans.id, id),
        eq(mealPlans.householdId, context.household.id),
      ),
    );
  if (!exists.length)
    return Response.json({ error: 'Meal not found.' }, { status: 404 });
  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'DELETE FROM meal_ingredients WHERE meal_id = ? AND household_id = ?',
      )
      .bind(id, context.household.id),
    binding
      .prepare('DELETE FROM meal_plans WHERE id = ? AND household_id = ?')
      .bind(id, context.household.id),
  ]);
  return Response.json({ id });
}

function parseMeal(body: Record<string, unknown>) {
  const name = textField(body.name);
  const plannedDate = textField(body.plannedDate);
  const rows = Array.isArray(body.ingredients)
    ? (body.ingredients as IngredientInput[])
    : [];
  const ingredients = rows
    .map((row) => ({
      name: textField(row.name),
      quantity: Number(row.quantity ?? 1),
      unit: textField(row.unit) || 'pcs',
      inventoryItemId:
        row.inventoryItemId === '' || row.inventoryItemId == null
          ? null
          : Number(row.inventoryItemId),
      estimatedPrice:
        row.estimatedPrice === '' || row.estimatedPrice == null
          ? null
          : Number(row.estimatedPrice),
    }))
    .filter((row) => row.name);
  const invalid = ingredients.some(
    (row) =>
      !Number.isFinite(row.quantity) ||
      row.quantity <= 0 ||
      (row.inventoryItemId !== null &&
        !Number.isInteger(row.inventoryItemId)) ||
      (row.estimatedPrice !== null &&
        (!Number.isFinite(row.estimatedPrice) || row.estimatedPrice < 0)),
  );
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate) || invalid)
    return { error: 'Please provide valid meal details.' };
  return {
    name,
    plannedDate,
    plannedTime: textField(body.plannedTime) || null,
    notes: textField(body.notes) || null,
    thumbnailUrl: textField(body.thumbnailUrl) || null,
    ingredients,
  };
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function validIngredientLinks(
  ingredients: Array<{ inventoryItemId: number | null }>,
  householdId: number,
) {
  const ids = [
    ...new Set(
      ingredients
        .map((item) => item.inventoryItemId)
        .filter((id): id is number => id !== null),
    ),
  ];
  if (!ids.length) return true;
  const placeholders = ids.map(() => '?').join(',');
  const row = await getDbBinding()
    .prepare(
      `SELECT COUNT(*) AS count FROM inventory_items WHERE household_id = ? AND id IN (${placeholders})`,
    )
    .bind(householdId, ...ids)
    .first<{ count: number }>();
  return Number(row?.count ?? 0) === ids.length;
}

function recordId() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}
