import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { inventoryItems, stockChanges } from '@/db/schema';
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
    .from(inventoryItems)
    .where(eq(inventoryItems.householdId, context.household.id))
    .orderBy(desc(inventoryItems.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const brand = await canonicalBrandName(body.brand, context.household.id);
  const name = await canonicalProductName(
    body.name,
    context.household.id,
    brand.name,
  );
  const category = await canonicalCategoryName(
    body.category,
    context.household.id,
  );
  const location = textField(body.location);
  const unit = textField(body.unit);
  const specificSpot = textField(body.specificSpot);
  const expiryDate = textField(body.expiryDate);
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
  const db = getDb();
  const normalizedName = normalizeName(name);
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
  const id = existingBatch?.id ?? recordId();
  const quantityBefore = existingBatch?.quantity ?? 0;
  const quantityAfter = quantityBefore + quantity;
  const itemWrite = existingBatch
    ? db
        .update(inventoryItems)
        .set({ quantity: quantityAfter, category, name, brand: brand.name })
        .where(
          and(
            eq(inventoryItems.id, id),
            eq(inventoryItems.householdId, context.household.id),
          ),
        )
        .returning()
    : db
        .insert(inventoryItems)
        .values({
          id,
          householdId: context.household.id,
          name,
          normalizedName,
          brand: brand.name,
          normalizedBrand: brand.normalizedName,
          category,
          location,
          specificSpot: specificSpot || null,
          unit,
          quantity,
          expiryDate: expiryDate || null,
        })
        .returning();
  const [itemRows] = await db.batch([
    itemWrite,
    db.insert(stockChanges).values({
      id: recordId(),
      householdId: context.household.id,
      inventoryItemId: id,
      itemName: name,
      normalizedName,
      brand: brand.name,
      normalizedBrand: brand.normalizedName,
      unit,
      quantityChange: quantity,
      quantityBefore,
      quantityAfter,
      reason: 'Stock in',
      createdAt: new Date().toISOString(),
    }),
  ]);
  return Response.json(itemRows[0], { status: existingBatch ? 200 : 201 });
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const brand = await canonicalBrandName(body.brand, context.household.id);
  const name = await canonicalProductName(
    body.name,
    context.household.id,
    brand.name,
  );
  const category = await canonicalCategoryName(
    body.category,
    context.household.id,
  );
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
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, context.household.id),
      ),
    )
    .limit(1);
  if (!current)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  const update = db
    .update(inventoryItems)
    .set({
      name,
      normalizedName: normalizeName(name),
      brand: brand.name,
      normalizedBrand: brand.normalizedName,
      category,
      location,
      specificSpot: textField(body.specificSpot) || null,
      unit,
      quantity,
      expiryDate: textField(body.expiryDate) || null,
    })
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, context.household.id),
      ),
    )
    .returning();
  let item;
  if (quantity !== current.quantity) {
    const [itemRows] = await db.batch([
      update,
      db.insert(stockChanges).values({
        id: recordId(),
        householdId: context.household.id,
        inventoryItemId: id,
        itemName: name,
        normalizedName: normalizeName(name),
        brand: brand.name,
        normalizedBrand: brand.normalizedName,
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
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
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
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, context.household.id),
      ),
    )
    .limit(1);
  if (!item)
    return Response.json({ error: 'Item not found.' }, { status: 404 });
  await db.batch([
    db
      .delete(stockChanges)
      .where(
        and(
          eq(stockChanges.inventoryItemId, id),
          eq(stockChanges.householdId, context.household.id),
        ),
      ),
    db
      .delete(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.householdId, context.household.id),
        ),
      ),
  ]);
  return Response.json({ id: item.id });
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
