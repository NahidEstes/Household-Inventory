import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { inventoryItems, stockChanges } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import { normalizeName, recordId } from '@/lib/security-core';

const removalReasons = new Set(['Used', 'Wasted', 'Other']);

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const inventoryItemId = Number(
    new URL(request.url).searchParams.get('itemId'),
  );
  if (!Number.isInteger(inventoryItemId))
    return Response.json(
      { error: 'A valid inventory item ID is required.' },
      { status: 400 },
    );

  const rows = await getDb()
    .select()
    .from(stockChanges)
    .where(
      and(
        eq(stockChanges.inventoryItemId, inventoryItemId),
        eq(stockChanges.householdId, context.household.id),
      ),
    )
    .orderBy(desc(stockChanges.createdAt), desc(stockChanges.id));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const inventoryItemId = Number(body.inventoryItemId);
  const quantity = Number(body.quantity);
  const reason = textField(body.reason);
  const note = textField(body.note);
  if (
    !Number.isInteger(inventoryItemId) ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !removalReasons.has(reason)
  )
    return Response.json(
      { error: 'Please provide a valid quantity and reason.' },
      { status: 400 },
    );

  const db = getDb();
  const [current] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, inventoryItemId),
        eq(inventoryItems.householdId, context.household.id),
      ),
    )
    .limit(1);
  if (!current)
    return Response.json(
      { error: 'Inventory item not found.' },
      { status: 404 },
    );
  if (quantity > current.quantity)
    return Response.json(
      { error: `You can remove at most ${current.quantity} ${current.unit}.` },
      { status: 409 },
    );

  const quantityAfter = Math.max(
    0,
    Math.round((current.quantity - quantity) * 10000) / 10000,
  );
  const historyId = recordId();
  const [updatedRows, historyRows] = await db.batch([
    db
      .update(inventoryItems)
      .set({ quantity: quantityAfter })
      .where(
        and(
          eq(inventoryItems.id, inventoryItemId),
          eq(inventoryItems.householdId, context.household.id),
        ),
      )
      .returning(),
    db
      .insert(stockChanges)
      .values({
        id: historyId,
        householdId: context.household.id,
        inventoryItemId,
        itemName: current.name,
        normalizedName: current.normalizedName ?? normalizeName(current.name),
        brand: current.brand,
        normalizedBrand: current.normalizedBrand,
        unit: current.unit,
        quantityChange: -quantity,
        quantityBefore: current.quantity,
        quantityAfter,
        reason,
        note: note || null,
        createdAt: new Date().toISOString(),
      })
      .returning(),
  ]);

  return Response.json({ item: updatedRows[0], history: historyRows[0] });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
