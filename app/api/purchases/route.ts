import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  expenses,
  inventoryItems,
  productBrands,
  purchases,
  stockChanges,
} from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import { syncEssentialShopping } from '@/lib/essentials';
import { canonicalBrandName } from '@/lib/brands';
import { canonicalCategoryName } from '@/lib/categories';
import { canonicalLocationName } from '@/lib/locations';
import { canonicalProductName } from '@/lib/products';
import {
  addQuantities,
  isValidQuantity,
  planPurchaseQuantityAdjustment,
  roundQuantity,
  subtractQuantities,
} from '@/lib/quantity';
import { batchIdentity } from '@/lib/authorization';
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
  const parsed = await parsePurchaseInput(body, context.household.id);
  if ('error' in parsed)
    return Response.json({ error: parsed.error }, { status: 400 });
  const {
    brand,
    category,
    expiryDate,
    itemName,
    location,
    purchasedAt,
    quantity,
    specificSpot,
    store,
    totalPrice,
    unit,
  } = parsed;

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
        sql`lower(trim(COALESCE(${inventoryItems.specificSpot}, ''))) = ${specificSpot.toLowerCase()}`,
        sql`COALESCE(${inventoryItems.expiryDate}, '') = ${expiryDate}`,
      ),
    )
    .limit(1);
  const inventoryItemId = existingBatch?.id ?? recordId();
  const quantityBefore = roundQuantity(existingBatch?.quantity ?? 0);
  const quantityAfter = addQuantities(quantityBefore, quantity);
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
        category: purchaseExpenseCategory(category),
        note: purchaseExpenseNote(itemName, brand.name, store),
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
  await syncEssentialShopping(context.household.id);
  return Response.json(
    {
      purchase: purchaseRows[0],
      inventoryItem: inventoryRows[0],
      expense: expenseRows[0],
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id))
    return Response.json(
      { error: 'A valid purchase ID is required.' },
      { status: 400 },
    );

  const parsed = await parsePurchaseInput(body, context.household.id, false);
  if ('error' in parsed)
    return Response.json({ error: parsed.error }, { status: 400 });

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

  const [[currentBatch], [linkedExpense]] = await Promise.all([
    db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, purchase.inventoryItemId),
          eq(inventoryItems.householdId, context.household.id),
        ),
      )
      .limit(1),
    db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.id, purchase.expenseId),
          eq(expenses.householdId, context.household.id),
        ),
      )
      .limit(1),
  ]);
  if (!currentBatch || !linkedExpense)
    return Response.json(
      {
        error:
          'This purchase is missing a linked inventory or expense record and cannot be edited safely.',
      },
      { status: 409 },
    );
  const currentBatchQuantity = roundQuantity(currentBatch.quantity);

  const currentIdentity = batchIdentity({
    name: purchase.itemName,
    brand: purchase.brand,
    unit: purchase.unit,
    location: purchase.location,
    specificSpot: purchase.specificSpot,
    expiryDate: purchase.expiryDate,
  });
  const nextIdentity = batchIdentity({
    name: parsed.itemName,
    brand: parsed.brand.name,
    unit: parsed.unit,
    location: parsed.location,
    specificSpot: parsed.specificSpot,
    expiryDate: parsed.expiryDate,
  });
  const identityChanged = currentIdentity !== nextIdentity;
  const adjustment = planPurchaseQuantityAdjustment({
    currentBatchQuantity,
    currentPurchaseQuantity: purchase.quantity,
    newPurchaseQuantity: parsed.quantity,
    identityChanged,
  });
  if (!adjustment.allowed)
    return Response.json(
      {
        error: identityChanged
          ? 'Product, brand, unit, location, specific spot or expiry cannot be changed because some stock from this purchase has already been used.'
          : `Only ${currentBatchQuantity} ${currentBatch.unit} remains in the linked batch, so this quantity reduction is not safe.`,
      },
      { status: 409 },
    );

  const normalizedName = normalizeName(parsed.itemName);
  const expenseCategory = purchaseExpenseCategory(parsed.category);
  const expenseNote = purchaseExpenseNote(
    parsed.itemName,
    parsed.brand.name,
    parsed.store,
  );
  const purchaseValues = {
    itemName: parsed.itemName,
    normalizedName,
    brand: parsed.brand.name,
    normalizedBrand: parsed.brand.normalizedName,
    category: parsed.category,
    quantity: parsed.quantity,
    unit: parsed.unit,
    totalPrice: parsed.totalPrice,
    purchasedAt: parsed.purchasedAt,
    expiryDate: parsed.expiryDate || null,
    store: parsed.store || null,
    location: parsed.location,
    specificSpot: parsed.specificSpot || null,
  };
  const purchaseUpdate = (inventoryItemId: number) =>
    db
      .update(purchases)
      .set({ ...purchaseValues, inventoryItemId })
      .where(
        and(
          eq(purchases.id, id),
          eq(purchases.householdId, context.household.id),
        ),
      )
      .returning();
  const expenseUpdate = db
    .update(expenses)
    .set({
      amount: parsed.totalPrice,
      category: expenseCategory,
      note: expenseNote,
      spentAt: parsed.purchasedAt,
    })
    .where(
      and(
        eq(expenses.id, purchase.expenseId),
        eq(expenses.householdId, context.household.id),
      ),
    )
    .returning();
  const editedAt = new Date().toISOString();
  const brandCatalogWrite = parsed.brand.normalizedName
    ? db
        .insert(productBrands)
        .values({
          id: recordId(),
          householdId: context.household.id,
          name: String(parsed.brand.name),
          normalizedName: parsed.brand.normalizedName,
        })
        .onConflictDoNothing()
    : db.select({ id: productBrands.id }).from(productBrands).limit(0);

  if (!identityChanged) {
    const [, inventoryRows, purchaseRows, expenseRows] = await db.batch([
      brandCatalogWrite,
      db
        .update(inventoryItems)
        .set({
          name: parsed.itemName,
          normalizedName,
          brand: parsed.brand.name,
          normalizedBrand: parsed.brand.normalizedName,
          category: parsed.category,
          quantity: adjustment.currentBatchAfter,
          unit: parsed.unit,
          location: parsed.location,
          specificSpot: parsed.specificSpot || null,
          expiryDate: parsed.expiryDate || null,
        })
        .where(
          and(
            eq(inventoryItems.id, currentBatch.id),
            eq(inventoryItems.householdId, context.household.id),
          ),
        )
        .returning(),
      purchaseUpdate(currentBatch.id),
      expenseUpdate,
      db.insert(stockChanges).values({
        id: recordId(),
        householdId: context.household.id,
        inventoryItemId: currentBatch.id,
        itemName: parsed.itemName,
        normalizedName,
        brand: parsed.brand.name,
        normalizedBrand: parsed.brand.normalizedName,
        unit: parsed.unit,
        quantityChange: adjustment.currentBatchChange,
        quantityBefore: currentBatchQuantity,
        quantityAfter: adjustment.currentBatchAfter,
        reason: 'Purchase edited',
        note: 'Purchase details adjusted',
        createdAt: editedAt,
      }),
    ]);
    await syncEssentialShopping(context.household.id);
    return Response.json({
      purchase: purchaseRows[0],
      inventoryItems: inventoryRows,
      expense: expenseRows[0],
    });
  }

  const [targetBatch] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.householdId, context.household.id),
        eq(inventoryItems.normalizedName, normalizedName),
        sql`COALESCE(${inventoryItems.normalizedBrand}, '') = ${parsed.brand.normalizedName ?? ''}`,
        eq(inventoryItems.unit, parsed.unit),
        eq(inventoryItems.location, parsed.location),
        sql`lower(trim(COALESCE(${inventoryItems.specificSpot}, ''))) = ${parsed.specificSpot.toLowerCase()}`,
        sql`COALESCE(${inventoryItems.expiryDate}, '') = ${parsed.expiryDate}`,
      ),
    )
    .limit(1);
  const targetInventoryItemId = targetBatch?.id ?? recordId();
  const targetQuantityBefore = roundQuantity(targetBatch?.quantity ?? 0);
  const targetQuantityAfter = addQuantities(
    targetQuantityBefore,
    adjustment.targetQuantityToAdd,
  );
  const targetWrite = targetBatch
    ? db
        .update(inventoryItems)
        .set({
          name: parsed.itemName,
          normalizedName,
          brand: parsed.brand.name,
          normalizedBrand: parsed.brand.normalizedName,
          category: parsed.category,
          quantity: targetQuantityAfter,
        })
        .where(
          and(
            eq(inventoryItems.id, targetInventoryItemId),
            eq(inventoryItems.householdId, context.household.id),
          ),
        )
        .returning()
    : db
        .insert(inventoryItems)
        .values({
          id: targetInventoryItemId,
          householdId: context.household.id,
          name: parsed.itemName,
          normalizedName,
          brand: parsed.brand.name,
          normalizedBrand: parsed.brand.normalizedName,
          category: parsed.category,
          quantity: parsed.quantity,
          unit: parsed.unit,
          location: parsed.location,
          specificSpot: parsed.specificSpot || null,
          expiryDate: parsed.expiryDate || null,
        })
        .returning();
  const [, oldInventoryRows, targetInventoryRows, purchaseRows, expenseRows] =
    await db.batch([
      brandCatalogWrite,
      db
        .update(inventoryItems)
        .set({ quantity: adjustment.currentBatchAfter })
        .where(
          and(
            eq(inventoryItems.id, currentBatch.id),
            eq(inventoryItems.householdId, context.household.id),
          ),
        )
        .returning(),
      targetWrite,
      purchaseUpdate(targetInventoryItemId),
      expenseUpdate,
      db.insert(stockChanges).values({
        id: recordId(),
        householdId: context.household.id,
        inventoryItemId: currentBatch.id,
        itemName: currentBatch.name,
        normalizedName: currentBatch.normalizedName,
        brand: currentBatch.brand,
        normalizedBrand: currentBatch.normalizedBrand,
        unit: currentBatch.unit,
        quantityChange: adjustment.currentBatchChange,
        quantityBefore: currentBatchQuantity,
        quantityAfter: adjustment.currentBatchAfter,
        reason: 'Purchase edited',
        note: `Moved to ${parsed.itemName} · ${parsed.location}`,
        createdAt: editedAt,
      }),
      db.insert(stockChanges).values({
        id: recordId(),
        householdId: context.household.id,
        inventoryItemId: targetInventoryItemId,
        itemName: parsed.itemName,
        normalizedName,
        brand: parsed.brand.name,
        normalizedBrand: parsed.brand.normalizedName,
        unit: parsed.unit,
        quantityChange: adjustment.targetQuantityToAdd,
        quantityBefore: targetQuantityBefore,
        quantityAfter: targetQuantityAfter,
        reason: 'Purchase edited',
        note: `Moved from ${currentBatch.name} · ${currentBatch.location}`,
        createdAt: editedAt,
      }),
    ]);

  await syncEssentialShopping(context.household.id);

  return Response.json({
    purchase: purchaseRows[0],
    inventoryItems: [...oldInventoryRows, ...targetInventoryRows],
    expense: expenseRows[0],
  });
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
  const removable = roundQuantity(
    Math.min(batch?.quantity ?? 0, purchase.quantity),
  );
  const quantityAfter = Math.max(
    0,
    subtractQuantities(batch?.quantity ?? 0, removable),
  );
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
        quantityBefore: roundQuantity(batch.quantity),
        quantityAfter,
        reason: 'Purchase deleted',
        createdAt: new Date().toISOString(),
      }),
    ]);
  } else await db.batch([deletePurchase, deleteExpense]);
  await syncEssentialShopping(context.household.id);
  return Response.json({
    id,
    inventoryItemId: purchase.inventoryItemId,
    expenseId: purchase.expenseId,
  });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function parsePurchaseInput(
  body: Record<string, unknown>,
  householdId: number,
  createBrand = true,
) {
  const brand = await canonicalBrandName(body.brand, householdId, createBrand);
  const itemName = await canonicalProductName(
    body.itemName,
    householdId,
    brand.name,
  );
  const category = await canonicalCategoryName(body.category, householdId);
  const location = await canonicalLocationName(body.location, householdId);
  const unit = textField(body.unit);
  const specificSpot = textField(body.specificSpot);
  const store = textField(body.store);
  const purchasedAt = textField(body.purchasedAt);
  const expiryDate = textField(body.expiryDate);
  const quantityValue = Number(body.quantity);
  const totalPrice = Number(body.totalPrice);
  if (
    !itemName ||
    !category ||
    !unit ||
    !location ||
    !/^\d{4}-\d{2}-\d{2}$/.test(purchasedAt) ||
    (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) ||
    !isValidQuantity(quantityValue) ||
    !Number.isFinite(totalPrice) ||
    totalPrice <= 0
  )
    return { error: 'Please provide valid purchase details.' } as const;
  return {
    brand,
    category,
    expiryDate,
    itemName,
    location,
    purchasedAt,
    quantity: roundQuantity(quantityValue),
    specificSpot,
    store,
    totalPrice,
    unit,
  };
}

function purchaseExpenseCategory(category: string) {
  return category === 'Household' ? 'Household' : 'Groceries';
}

function purchaseExpenseNote(
  itemName: string,
  brand: string | null,
  store: string,
) {
  return `${itemName}${brand ? ` · ${brand}` : ''}${store ? ` · ${store}` : ''}`;
}
