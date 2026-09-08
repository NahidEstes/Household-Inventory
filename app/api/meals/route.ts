import { asc, eq } from 'drizzle-orm';
import { getDb, getDbBinding } from '@/db';
import { inventoryItems, mealIngredients, mealPlans } from '@/db/schema';

type IngredientInput = {
  name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  inventoryItemId?: unknown;
  estimatedPrice?: unknown;
};

export async function GET() {
  const db = getDb();
  const [meals, ingredients, inventory] = await Promise.all([
    db
      .select()
      .from(mealPlans)
      .orderBy(asc(mealPlans.plannedDate), asc(mealPlans.plannedTime)),
    db.select().from(mealIngredients).orderBy(asc(mealIngredients.id)),
    db.select().from(inventoryItems),
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
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseMeal(body);
  if ('error' in parsed) return Response.json(parsed, { status: 400 });
  const mealId = recordId();
  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'INSERT INTO meal_plans (id, name, planned_date, planned_time, notes, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        mealId,
        parsed.name,
        parsed.plannedDate,
        parsed.plannedTime,
        parsed.notes,
        parsed.thumbnailUrl,
      ),
    ...parsed.ingredients.map((ingredient) =>
      binding
        .prepare(
          'INSERT INTO meal_ingredients (id, meal_id, name, quantity, unit, inventory_item_id, estimated_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          recordId(),
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
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const parsed = parseMeal(body);
  if (!Number.isInteger(id) || 'error' in parsed)
    return Response.json(
      'error' in parsed ? parsed : { error: 'A valid meal ID is required.' },
      { status: 400 },
    );
  const exists = await getDb()
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(eq(mealPlans.id, id));
  if (!exists.length)
    return Response.json({ error: 'Meal not found.' }, { status: 404 });
  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'UPDATE meal_plans SET name = ?, planned_date = ?, planned_time = ?, notes = ?, thumbnail_url = ? WHERE id = ?',
      )
      .bind(
        parsed.name,
        parsed.plannedDate,
        parsed.plannedTime,
        parsed.notes,
        parsed.thumbnailUrl,
        id,
      ),
    binding.prepare('DELETE FROM meal_ingredients WHERE meal_id = ?').bind(id),
    ...parsed.ingredients.map((ingredient) =>
      binding
        .prepare(
          'INSERT INTO meal_ingredients (id, meal_id, name, quantity, unit, inventory_item_id, estimated_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          recordId(),
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
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid meal ID is required.' },
      { status: 400 },
    );
  const exists = await getDb()
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(eq(mealPlans.id, id));
  if (!exists.length)
    return Response.json({ error: 'Meal not found.' }, { status: 404 });
  const binding = getDbBinding();
  await binding.batch([
    binding.prepare('DELETE FROM meal_ingredients WHERE meal_id = ?').bind(id),
    binding.prepare('DELETE FROM meal_plans WHERE id = ?').bind(id),
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

function recordId() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}
