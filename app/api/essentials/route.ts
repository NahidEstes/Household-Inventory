import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { essentialItems, householdSettings, inventoryItems } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import {
  aggregateEssentialStock,
  essentialStatus,
} from '@/lib/essentials-core';
import { syncEssentialShopping } from '@/lib/essentials';
import { isValidQuantity, roundQuantity } from '@/lib/quantity';
import { normalizeName } from '@/lib/security-core';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const db = getDb();
  const [rules, batches, settings] = await Promise.all([
    db
      .select()
      .from(essentialItems)
      .where(eq(essentialItems.householdId, context.household.id)),
    db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.householdId, context.household.id)),
    db
      .select({ autoAddEssentials: householdSettings.autoAddEssentials })
      .from(householdSettings)
      .where(eq(householdSettings.householdId, context.household.id))
      .limit(1),
  ]);
  return Response.json({
    autoAddWhenLow: settings[0]?.autoAddEssentials ?? false,
    items: rules.map((rule) => {
      const { matching, currentStock } = aggregateEssentialStock(
        rule,
        batches,
        normalizeName,
      );
      const example =
        matching.find((batch) => batch.quantity > 0) ?? matching[0];
      const activeLocations = new Set(
        matching.filter((batch) => batch.quantity > 0).map((batch) => batch.location),
      );
      return {
        ...rule,
        currentStock,
        category: example?.category ?? '—',
        location: activeLocations.size > 1 ? 'Multiple' : example?.location ?? '—',
        status: essentialStatus(currentStock, rule.minimumStock),
      };
    }),
  });
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const inventoryItemId = Number(body.inventoryItemId);
  const minimumStock = Number(body.minimumStock);
  if (!Number.isInteger(inventoryItemId) || !isValidQuantity(minimumStock))
    return Response.json(
      { error: 'Select an inventory item and enter a valid minimum stock.' },
      { status: 400 },
    );
  const db = getDb();
  const [batch] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, inventoryItemId),
        eq(inventoryItems.householdId, context.household.id),
      ),
    )
    .limit(1);
  if (!batch)
    return Response.json(
      { error: 'Inventory item not found.' },
      { status: 404 },
    );
  if (body.minimumStockUnit !== batch.unit)
    return Response.json(
      { error: 'Choose the same unit used by this inventory item.' },
      { status: 400 },
    );
  const normalizedName = batch.normalizedName ?? normalizeName(batch.name);
  const normalizedBrand = batch.normalizedBrand ?? normalizeName(batch.brand ?? '');
  const [duplicate] = await db.select({ id: essentialItems.id }).from(essentialItems).where(and(
    eq(essentialItems.householdId, context.household.id),
    eq(essentialItems.normalizedName, normalizedName),
    eq(essentialItems.normalizedBrand, normalizedBrand),
    sql`lower(${essentialItems.unit}) = ${batch.unit.toLowerCase()}`,
  )).limit(1);
  if (duplicate) return Response.json({ error: 'This product and unit is already an essential.' }, { status: 409 });
  const [created] = await db
    .insert(essentialItems)
    .values({
      householdId: context.household.id,
      name: batch.name,
      normalizedName,
      brand: batch.brand,
      normalizedBrand,
      unit: batch.unit,
      minimumStock: roundQuantity(minimumStock),
      minimumStockUnit: batch.unit,
      autoAddToShoppingList: body.autoAddToShoppingList === true,
    })
    .onConflictDoNothing()
    .returning();
  if (!created)
    return Response.json(
      { error: 'This product and unit is already an essential.' },
      { status: 409 },
    );
  await syncEssentialShopping(context.household.id);
  return Response.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const minimumStock = Number(body.minimumStock);
  if (
    !Number.isInteger(id) ||
    !isValidQuantity(minimumStock) ||
    typeof body.autoAddToShoppingList !== 'boolean'
  )
    return Response.json(
      { error: 'Enter a valid minimum stock and auto-add preference.' },
      { status: 400 },
    );
  const db = getDb();
  const [updated] = await db
    .update(essentialItems)
    .set({
      minimumStock: roundQuantity(minimumStock),
      autoAddToShoppingList: body.autoAddToShoppingList,
    })
    .where(
      and(
        eq(essentialItems.id, id),
        eq(essentialItems.householdId, context.household.id),
      ),
    )
    .returning();
  if (!updated)
    return Response.json({ error: 'Essential not found.' }, { status: 404 });
  await syncEssentialShopping(context.household.id);
  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid essential ID is required.' },
      { status: 400 },
    );
  const [deleted] = await getDb()
    .delete(essentialItems)
    .where(
      and(
        eq(essentialItems.id, id),
        eq(essentialItems.householdId, context.household.id),
      ),
    )
    .returning();
  if (!deleted)
    return Response.json({ error: 'Essential not found.' }, { status: 404 });
  return Response.json({ id: deleted.id });
}
