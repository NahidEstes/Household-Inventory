import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { inventoryItems } from '@/db/schema';

export async function GET() {
  const rows = await getDb()
    .select()
    .from(inventoryItems)
    .orderBy(desc(inventoryItems.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const name = textField(body.name);
  const category = textField(body.category);
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
  const [item] = await getDb()
    .insert(inventoryItems)
    .values({
      name,
      category,
      location,
      specificSpot: textField(body.specificSpot) || null,
      unit,
      quantity,
      expiryDate: textField(body.expiryDate) || null,
    })
    .returning();
  return Response.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const name = textField(body.name);
  const category = textField(body.category);
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
  const [item] = await getDb()
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
  const [item] = await getDb()
    .delete(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .returning();
  if (!item)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json({ id: item.id });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
