import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { productLocations } from '@/db/schema';

export function cleanLocationName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function normalizeLocationName(value: unknown) {
  return cleanLocationName(value).toLocaleLowerCase('en-US');
}

export async function canonicalLocationName(
  value: unknown,
  householdId: number,
) {
  const normalized = normalizeLocationName(value);
  if (!normalized) return '';
  const [location] = await getDb()
    .select({ name: productLocations.name })
    .from(productLocations)
    .where(
      and(
        eq(productLocations.householdId, householdId),
        eq(productLocations.normalizedName, normalized),
      ),
    )
    .limit(1);
  return location?.name ?? '';
}
