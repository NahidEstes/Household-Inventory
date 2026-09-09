import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { inventoryItems, stockChanges } from '@/db/schema';
import { canonicalCategoryName } from '@/lib/categories';
import { canonicalProductName } from '@/lib/products';

export async function GET() {
  const rows = await getDb()
    .select()
    .from(inventoryItems)
    .orderBy(desc(inventoryItems.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const name = await canonicalProductName(body.name);
  const category = await canonicalCategoryName(body.category);
  const location = textField(body.location);
  const unit = textField(body.unit);
  const quantity = Number(body.quantity);
  if (
    !name ||
    !category ||
    !location ||
    !unit ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return Response.json(
      { error: 'Please provide valid item details.' },
      { status: 400 },
    );
  }
  const id = recordId();
  const db = getDb();
  const [itemRows] = await db.batch([
    db
      .insert(inventoryItems)
      .values({
        id,
        name,
        category,
        location,
        specificSpot: textField(body.specificSpot) || null,
        unit,
        quantity,
        expiryDate: textField(body.expiryDate) || null,
      })
      .returning(),
    db.insert(stockChanges).values({
      id: recordId(),
      inventoryItemId: id,
      itemName: name,
      unit,
      quantityChange: quantity,
      quantityBefore: 0,
      quantityAfter: quantity,
      reason: 'Stock in',
      createdAt: new Date().toISOString(),
    }),
  ]);
  return Response.json(itemRows[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const name = await canonicalProductName(body.name);
  const category = await canonicalCategoryName(body.category);
  const location = textField(body.location);
  const unit = textField(body.unit);
  const quantity = Number(body.quantity);
  if (
    !Number.isInteger(id) ||
    !name ||
    !category ||
    !location ||
    !unit ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return Response.json(
      { error: 'Please provide valid item details.' },
      { status: 400 },
    );
  }
  const db = getDb();
  const [current] = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1);
  if (!current)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  const update = db
    .update(inventoryItems)
    .set({
      name,
      category,
      location,
      specificSpot: textField(body.specificSpot) || null,
      unit,
      quantity,
      expiryDate: textField(body.expiryDate) || null,
    })
    .where(eq(inventoryItems.id, id))
    .returning();
  let item;
  if (quantity !== current.quantity) {
    const [itemRows] = await db.batch([
      update,
      db.insert(stockChanges).values({
        id: recordId(),
        inventoryItemId: id,
        itemName: name,
        unit,
        quantityChange: quantity - current.quantity,
        quantityBefore: current.quantity,
        quantityAfter: quantity,
        reason: 'Adjustment',
        createdAt: new Date().toISOString(),
      }),
    ]);
    item = itemRows[0];
  } else {
    [item] = await update;
  }
  if (!item)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json(item);
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid item ID is required.' },
      { status: 400 },
    );
  const db = getDb();
  const [item] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1);
  if (!item)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  await db.batch([
    db.delete(stockChanges).where(eq(stockChanges.inventoryItemId, id)),
    db.delete(inventoryItems).where(eq(inventoryItems.id, id)),
  ]);
  return Response.json({ id: item.id });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function recordId() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}
