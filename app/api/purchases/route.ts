import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { expenses, inventoryItems, purchases } from '@/db/schema';

export async function GET() {
  const rows = await getDb()
    .select()
    .from(purchases)
    .orderBy(desc(purchases.purchasedAt), desc(purchases.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const itemName = textField(body.itemName);
  const category = textField(body.category);
  const unit = textField(body.unit);
  const location = textField(body.location);
  const specificSpot = textField(body.specificSpot);
  const store = textField(body.store);
  const purchasedAt = textField(body.purchasedAt);
  const expiryDate = textField(body.expiryDate);
  const quantity = Number(body.quantity);
  const totalPrice = Number(body.totalPrice);

  if (
    !itemName ||
    !category ||
    !unit ||
    !location ||
    !purchasedAt ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(totalPrice) ||
    totalPrice <= 0
  ) {
    return Response.json(
      { error: 'Please provide valid purchase details.' },
      { status: 400 },
    );
  }

  const inventoryItemId = recordId();
  const expenseId = recordId();
  const purchaseId = recordId();
  const db = getDb();
  const [inventoryRows, expenseRows, purchaseRows] = await db.batch([
    db
      .insert(inventoryItems)
      .values({
        id: inventoryItemId,
        name: itemName,
        category,
        quantity,
        unit,
        location,
        specificSpot: specificSpot || null,
        expiryDate: expiryDate || null,
      })
      .returning(),
    db
      .insert(expenses)
      .values({
        id: expenseId,
        amount: totalPrice,
        category: category === 'Household' ? 'Household' : 'Groceries',
        note: `${itemName}${store ? ` · ${store}` : ''}`,
        spentAt: purchasedAt,
      })
      .returning(),
    db
      .insert(purchases)
      .values({
        id: purchaseId,
        itemName,
        category,
        quantity,
        unit,
        totalPrice,
        purchasedAt,
        expiryDate: expiryDate || null,
        store: store || null,
        location,
        inventoryItemId,
        expenseId,
      })
      .returning(),
  ]);

  return Response.json(
    {
      purchase: purchaseRows[0],
      inventoryItem: inventoryRows[0],
      expense: expenseRows[0],
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid purchase ID is required.' },
      { status: 400 },
    );

  const db = getDb();
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, id))
    .limit(1);
  if (!purchase)
    return Response.json({ error: 'Purchase not found.' }, { status: 404 });

  await db.batch([
    db.delete(purchases).where(eq(purchases.id, id)),
    db
      .delete(inventoryItems)
      .where(eq(inventoryItems.id, purchase.inventoryItemId)),
    db.delete(expenses).where(eq(expenses.id, purchase.expenseId)),
  ]);
  return Response.json({
    id,
    inventoryItemId: purchase.inventoryItemId,
    expenseId: purchase.expenseId,
  });
}

function recordId() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
