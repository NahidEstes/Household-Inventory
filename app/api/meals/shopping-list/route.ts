import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb, getDbBinding } from '@/db';
import {
  inventoryItems,
  mealIngredients,
  mealPlans,
  shoppingItems,
} from '@/db/schema';
import { requireApiContext } from '@/lib/auth';

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const weekStart = textField(body.weekStart);
  const weekEnd = textField(body.weekEnd);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)
  )
    return Response.json(
      { error: 'A valid week range is required.' },
      { status: 400 },
    );

  const db = getDb();
  const [meals, ingredients, inventory, existing] = await Promise.all([
    db
      .select()
      .from(mealPlans)
      .where(
        and(
          gte(mealPlans.plannedDate, weekStart),
          lte(mealPlans.plannedDate, weekEnd),
          eq(mealPlans.householdId, context.household.id),
        ),
      ),
    db
      .select()
      .from(mealIngredients)
      .where(eq(mealIngredients.householdId, context.household.id)),
    db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.householdId, context.household.id)),
    db
      .select()
      .from(shoppingItems)
      .where(
        and(
          eq(shoppingItems.householdId, context.household.id),
          eq(shoppingItems.completed, false),
        ),
      ),
  ]);
  const mealDates = new Map(meals.map((meal) => [meal.id, meal.plannedDate]));
  const stock = new Map(inventory.map((item) => [item.id, item]));
  const existingKeys = new Set(
    existing.map(
      (item) =>
        `${item.name.toLowerCase()}|${item.unit}|${item.scheduledDate ?? ''}`,
    ),
  );
  const missing = new Map<
    string,
    {
      name: string;
      quantity: number;
      unit: string;
      estimatedPrice: number | null;
      scheduledDate: string;
    }
  >();

  for (const ingredient of ingredients) {
    const scheduledDate = mealDates.get(ingredient.mealId);
    if (!scheduledDate) continue;
    const available = ingredient.inventoryItemId
      ? (stock.get(ingredient.inventoryItemId)?.quantity ?? 0)
      : 0;
    const quantity = Math.max(ingredient.quantity - available, 0);
    if (quantity <= 0) continue;
    const key = `${ingredient.name.toLowerCase()}|${ingredient.unit}|${scheduledDate}`;
    if (existingKeys.has(key)) continue;
    const current = missing.get(key);
    if (current) {
      current.quantity += quantity;
      if (ingredient.estimatedPrice !== null)
        current.estimatedPrice =
          (current.estimatedPrice ?? 0) + ingredient.estimatedPrice;
    } else {
      missing.set(key, {
        name: ingredient.name,
        quantity,
        unit: ingredient.unit,
        estimatedPrice: ingredient.estimatedPrice,
        scheduledDate,
      });
    }
  }

  const rows = [...missing.values()];
  if (rows.length) {
    const binding = getDbBinding();
    await binding.batch(
      rows.map((row) =>
        binding
          .prepare(
            'INSERT INTO shopping_items (household_id, name, quantity, unit, estimated_price, scheduled_date, completed) VALUES (?, ?, ?, ?, ?, ?, 0)',
          )
          .bind(
            context.household.id,
            row.name,
            row.quantity,
            row.unit,
            row.estimatedPrice,
            row.scheduledDate,
          ),
      ),
    );
  }
  return Response.json({ createdCount: rows.length });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
