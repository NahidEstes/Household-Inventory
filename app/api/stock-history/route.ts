import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { inventoryItems, stockChanges } from '@/db/schema';

const removalReasons = new Set(['Used', 'Wasted', 'Other']);

export async function GET(request: Request) {
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
    .where(eq(stockChanges.inventoryItemId, inventoryItemId))
    .orderBy(desc(stockChanges.createdAt), desc(stockChanges.id));
  return Response.json(rows);
}

export async function POST(request: Request) {
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
    .where(eq(inventoryItems.id, inventoryItemId))
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
      .where(eq(inventoryItems.id, inventoryItemId))
      .returning(),
    db
      .insert(stockChanges)
      .values({
        id: historyId,
        inventoryItemId,
        itemName: current.name,
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

function recordId() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
