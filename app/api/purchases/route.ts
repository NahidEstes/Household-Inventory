import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { expenses, inventoryItems, purchases, stockChanges } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import { canonicalBrandName } from '@/lib/brands';
import { canonicalCategoryName } from '@/lib/categories';
import { canonicalProductName } from '@/lib/products';
import { normalizeName, recordId } from '@/lib/security-core';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const rows = await getDb()
    .select()
    .from(purchases)
    .where(eq(purchases.householdId, context.household.id))
    .orderBy(desc(purchases.purchasedAt), desc(purchases.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const brand = await canonicalBrandName(body.brand, context.household.id);
  const itemName = await canonicalProductName(
    body.itemName,
    context.household.id,
    brand.name,
  );
  const category = await canonicalCategoryName(
    body.category,
    context.household.id,
  );
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
    !/^\d{4}-\d{2}-\d{2}$/.test(purchasedAt) ||
    (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(totalPrice) ||
    totalPrice <= 0
  )
    return Response.json(
      { error: 'Please provide valid purchase details.' },
      { status: 400 },
    );

  const db = getDb();
  const normalizedName = normalizeName(itemName);
  const [existingBatch] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.householdId, context.household.id),
        eq(inventoryItems.normalizedName, normalizedName),
        sql`COALESCE(${inventoryItems.normalizedBrand}, '') = ${brand.normalizedName ?? ''}`,
        eq(inventoryItems.unit, unit),
        eq(inventoryItems.location, location),
        sql`COALESCE(${inventoryItems.specificSpot}, '') = ${specificSpot}`,
        sql`COALESCE(${inventoryItems.expiryDate}, '') = ${expiryDate}`,
      ),
    )
    .limit(1);
  const inventoryItemId = existingBatch?.id ?? recordId();
  const quantityBefore = existingBatch?.quantity ?? 0;
  const quantityAfter = quantityBefore + quantity;
  const expenseId = recordId();
  const purchaseId = recordId();
  const inventoryWrite = existingBatch
    ? db
        .update(inventoryItems)
        .set({
          quantity: quantityAfter,
          category,
          name: itemName,
          brand: brand.name,
        })
        .where(
          and(
            eq(inventoryItems.id, inventoryItemId),
            eq(inventoryItems.householdId, context.household.id),
          ),
        )
        .returning()
    : db
        .insert(inventoryItems)
        .values({
          id: inventoryItemId,
          householdId: context.household.id,
          name: itemName,
          normalizedName,
          brand: brand.name,
          normalizedBrand: brand.normalizedName,
          category,
          quantity,
          unit,
          location,
          specificSpot: specificSpot || null,
          expiryDate: expiryDate || null,
        })
        .returning();
  const [inventoryRows, expenseRows, purchaseRows] = await db.batch([
    inventoryWrite,
    db
      .insert(expenses)
      .values({
        id: expenseId,
        householdId: context.household.id,
        amount: totalPrice,
        category: category === 'Household' ? 'Household' : 'Groceries',
        note: `${itemName}${brand.name ? ` · ${brand.name}` : ''}${store ? ` · ${store}` : ''}`,
        spentAt: purchasedAt,
      })
      .returning(),
    db
      .insert(purchases)
      .values({
        id: purchaseId,
        householdId: context.household.id,
        itemName,
        normalizedName,
        brand: brand.name,
        normalizedBrand: brand.normalizedName,
        category,
        quantity,
        unit,
        totalPrice,
        purchasedAt,
        expiryDate: expiryDate || null,
        store: store || null,
        location,
        specificSpot: specificSpot || null,
        inventoryItemId,
        expenseId,
      })
      .returning(),
    db.insert(stockChanges).values({
      id: recordId(),
      householdId: context.household.id,
      inventoryItemId,
      itemName,
      normalizedName,
      brand: brand.name,
      normalizedBrand: brand.normalizedName,
      unit,
      quantityChange: quantity,
      quantityBefore,
      quantityAfter,
      reason: 'Purchase',
      note: store || null,
      createdAt: new Date().toISOString(),
    }),
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
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
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
    .where(
      and(
        eq(purchases.id, id),
        eq(purchases.householdId, context.household.id),
      ),
    )
    .limit(1);
  if (!purchase)
    return Response.json({ error: 'Purchase not found.' }, { status: 404 });
  const [batch] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, purchase.inventoryItemId),
        eq(inventoryItems.householdId, context.household.id),
      ),
    )
    .limit(1);
  const removable = Math.min(batch?.quantity ?? 0, purchase.quantity);
  const quantityAfter = Math.max(0, (batch?.quantity ?? 0) - removable);
  const deletePurchase = db
    .delete(purchases)
    .where(
      and(
        eq(purchases.id, id),
        eq(purchases.householdId, context.household.id),
      ),
    );
  const deleteExpense = db
    .delete(expenses)
    .where(
      and(
        eq(expenses.id, purchase.expenseId),
        eq(expenses.householdId, context.household.id),
      ),
    );
  if (batch && removable > 0) {
    await db.batch([
      deletePurchase,
      deleteExpense,
      db
        .update(inventoryItems)
        .set({ quantity: quantityAfter })
        .where(
          and(
            eq(inventoryItems.id, batch.id),
            eq(inventoryItems.householdId, context.household.id),
          ),
        ),
      db.insert(stockChanges).values({
        id: recordId(),
        householdId: context.household.id,
        inventoryItemId: batch.id,
        itemName: batch.name,
        normalizedName: batch.normalizedName,
        brand: batch.brand,
        normalizedBrand: batch.normalizedBrand,
        unit: batch.unit,
        quantityChange: -removable,
        quantityBefore: batch.quantity,
        quantityAfter,
        reason: 'Purchase deleted',
        createdAt: new Date().toISOString(),
      }),
    ]);
  } else await db.batch([deletePurchase, deleteExpense]);
  return Response.json({
    id,
    inventoryItemId: purchase.inventoryItemId,
    expenseId: purchase.expenseId,
  });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
