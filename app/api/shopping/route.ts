import { asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { shoppingItems } from '@/db/schema';

export async function GET() {
  const rows = await getDb()
    .select()
    .from(shoppingItems)
    .orderBy(
      sql`${shoppingItems.scheduledDate} IS NULL`,
      asc(shoppingItems.scheduledDate),
      desc(shoppingItems.createdAt),
    );
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const name = textField(body.name);
  const quantity = Number(body.quantity ?? 1);
  const unit = textField(body.unit) || 'pcs';
  const estimatedPrice =
    body.estimatedPrice === '' || body.estimatedPrice == null
      ? null
      : Number(body.estimatedPrice);
  if (
    !name ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !unit ||
    (estimatedPrice !== null &&
      (!Number.isFinite(estimatedPrice) || estimatedPrice < 0))
  )
    return Response.json(
      { error: 'Please provide valid scheduled item details.' },
      { status: 400 },
    );
  const [item] = await getDb()
    .insert(shoppingItems)
    .values({
      name,
      quantity,
      unit,
      estimatedPrice,
      scheduledDate: textField(body.scheduledDate) || null,
    })
    .returning();
  return Response.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid item ID is required.' },
      { status: 400 },
    );
  const completed = Boolean(body.completed);
  const name = textField(body.name);
  const quantity = Number(body.quantity);
  const unit = textField(body.unit);
  const estimatedPrice =
    body.estimatedPrice === '' || body.estimatedPrice == null
      ? null
      : Number(body.estimatedPrice);
  const isDetailsUpdate = Boolean(name || unit || body.scheduledDate);
  if (
    isDetailsUpdate &&
    (!name ||
      !unit ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      (estimatedPrice !== null &&
        (!Number.isFinite(estimatedPrice) || estimatedPrice < 0)))
  )
    return Response.json(
      { error: 'Please provide valid scheduled item details.' },
      { status: 400 },
    );
  const [item] = await getDb()
    .update(shoppingItems)
    .set(
      isDetailsUpdate
        ? {
            name,
            quantity,
            unit,
            estimatedPrice,
            scheduledDate: textField(body.scheduledDate) || null,
          }
        : { completed },
    )
    .where(eq(shoppingItems.id, id))
    .returning();
  if (!item)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json(item);
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid item ID is required.' },
      { status: 400 },
    );
  const [item] = await getDb()
    .delete(shoppingItems)
    .where(eq(shoppingItems.id, id))
    .returning();
  if (!item)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json({ id: item.id });
}
