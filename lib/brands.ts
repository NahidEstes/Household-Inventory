import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { productBrands } from '@/db/schema';
import { cleanText, normalizeName, recordId } from '@/lib/security-core';

export function cleanBrandName(value: unknown) {
  return cleanText(value, 100);
}

export function normalizeBrandName(value: unknown) {
  return normalizeName(cleanBrandName(value));
}

export async function canonicalBrandName(value: unknown, householdId: number) {
  const name = cleanBrandName(value);
  const normalizedName = normalizeBrandName(name);
  if (!normalizedName) return { name: null, normalizedName: null };
  const db = getDb();
  const [existing] = await db
    .select({ name: productBrands.name })
    .from(productBrands)
    .where(
      and(
        eq(productBrands.householdId, householdId),
        eq(productBrands.normalizedName, normalizedName),
      ),
    )
    .limit(1);
  if (existing) return { name: existing.name, normalizedName };
  await db
    .insert(productBrands)
    .values({ id: recordId(), householdId, name, normalizedName })
    .onConflictDoNothing();
  const [created] = await db
    .select({ name: productBrands.name })
    .from(productBrands)
    .where(
      and(
        eq(productBrands.householdId, householdId),
        eq(productBrands.normalizedName, normalizedName),
      ),
    )
    .limit(1);
  return { name: created?.name ?? name, normalizedName };
}
