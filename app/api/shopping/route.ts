import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { shoppingItems } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import { canonicalProductName } from '@/lib/products';
import { isValidQuantity, roundQuantity } from '@/lib/quantity';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const rows = await getDb()
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.householdId, context.household.id))
    .orderBy(
      sql`${shoppingItems.scheduledDate} IS NULL`,
      asc(shoppingItems.scheduledDate),
      desc(shoppingItems.createdAt),
    );
  return Response.json(rows);
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const name = await canonicalProductName(body.name, context.household.id);
  const quantityValue = Number(body.quantity ?? 1);
  const unit = textField(body.unit) || 'pcs';
  const estimatedPrice =
    body.estimatedPrice === '' || body.estimatedPrice == null
      ? null
      : Number(body.estimatedPrice);
  if (
    !name ||
    !isValidQuantity(quantityValue) ||
    !unit ||
    (estimatedPrice !== null &&
      (!Number.isFinite(estimatedPrice) || estimatedPrice < 0))
  )
    return Response.json(
      { error: 'Please provide valid scheduled item details.' },
      { status: 400 },
    );
  const quantity = roundQuantity(quantityValue);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, context.household.id),
        eq(shoppingItems.completed, false),
        eq(shoppingItems.unit, unit),
        eq(sql`lower(trim(${shoppingItems.name}))`, name.toLowerCase()),
      ),
    )
    .limit(1);
  if (existing) return Response.json(existing);

  const [item] = await db
    .insert(shoppingItems)
    .values({
      householdId: context.household.id,
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
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid item ID is required.' },
      { status: 400 },
    );
  const db = getDb();
  const [current] = await db
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.id, id),
        eq(shoppingItems.householdId, context.household.id),
      ),
    )
    .limit(1);
  if (!current)
    return Response.json({ error: 'Item not found.' }, { status: 404 });

  const isDetailsUpdate = [
    'name',
    'quantity',
    'unit',
    'estimatedPrice',
    'scheduledDate',
  ].some((key) => Object.hasOwn(body, key));
  const hasCompletedUpdate = typeof body.completed === 'boolean';
  if (!isDetailsUpdate && !hasCompletedUpdate)
    return Response.json(
      { error: 'No shopping item changes were provided.' },
      { status: 400 },
    );

  if (hasCompletedUpdate && body.completed === false && current.completed) {
    const [activeDuplicate] = await db
      .select({ id: shoppingItems.id })
      .from(shoppingItems)
      .where(
        and(
          eq(shoppingItems.householdId, context.household.id),
          eq(shoppingItems.completed, false),
          eq(shoppingItems.unit, current.unit),
          eq(
            sql`lower(trim(${shoppingItems.name}))`,
            current.name.trim().toLowerCase(),
          ),
        ),
      )
      .limit(1);
    if (activeDuplicate)
      return Response.json(
        { error: 'This item is already active in your shopping list.' },
        { status: 409 },
      );
  }

  let changes: Partial<typeof shoppingItems.$inferInsert> = {};
  if (isDetailsUpdate) {
    const name = await canonicalProductName(body.name, context.household.id);
    const quantityValue = Number(body.quantity);
    const unit = textField(body.unit);
    const estimatedPrice =
      body.estimatedPrice === '' || body.estimatedPrice == null
        ? null
        : Number(body.estimatedPrice);
    if (
      !name ||
      !unit ||
      !isValidQuantity(quantityValue) ||
      (estimatedPrice !== null &&
        (!Number.isFinite(estimatedPrice) || estimatedPrice < 0))
    )
      return Response.json(
        { error: 'Please provide valid scheduled item details.' },
        { status: 400 },
      );
    const quantity = roundQuantity(quantityValue);
    changes = {
      name,
      quantity,
      unit,
      estimatedPrice,
      scheduledDate: textField(body.scheduledDate) || null,
    };
  }
  if (hasCompletedUpdate) changes.completed = body.completed as boolean;

  const [item] = await db
    .update(shoppingItems)
    .set(changes)
    .where(
      and(
        eq(shoppingItems.id, id),
        eq(shoppingItems.householdId, context.household.id),
      ),
    )
    .returning();
  return Response.json(item);
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid item ID is required.' },
      { status: 400 },
    );
  const [item] = await getDb()
    .delete(shoppingItems)
    .where(
      and(
        eq(shoppingItems.id, id),
        eq(shoppingItems.householdId, context.household.id),
      ),
    )
    .returning();
  if (!item)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json({ id: item.id });
}
