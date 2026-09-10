import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { inventoryItems } from '@/db/schema';

export type ProductDefaults = {
  inventoryItemId: number;
  name: string;
  brand: string | null;
  category: string;
  unit: string;
  location: string;
  specificSpot: string | null;
};

export function cleanProductName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export async function resolveProduct(
  value: unknown,
  householdId: number,
  brand?: unknown,
) {
  const name = cleanProductName(value);
  if (!name) return null;

  const [existing] = await getDb()
    .select({
      inventoryItemId: inventoryItems.id,
      name: inventoryItems.name,
      brand: inventoryItems.brand,
      category: inventoryItems.category,
      unit: inventoryItems.unit,
      location: inventoryItems.location,
      specificSpot: inventoryItems.specificSpot,
    })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.householdId, householdId),
        eq(sql`lower(trim(${inventoryItems.name}))`, name.toLowerCase()),
        brand
          ? eq(
              sql`coalesce(${inventoryItems.normalizedBrand}, '')`,
              cleanProductName(brand).toLowerCase(),
            )
          : undefined,
      ),
    )
    .orderBy(
      sql`CASE WHEN ${inventoryItems.quantity} > 0 THEN 0 ELSE 1 END`,
      sql`CASE WHEN ${inventoryItems.expiryDate} IS NULL THEN 1 ELSE 0 END`,
      inventoryItems.expiryDate,
      desc(inventoryItems.createdAt),
    )
    .limit(1);

  return existing ?? { name };
}

export async function canonicalProductName(
  value: unknown,
  householdId: number,
  brand?: unknown,
) {
  const product = await resolveProduct(value, householdId, brand);
  return product?.name ?? '';
}
