import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { productCategories } from '@/db/schema';

export function cleanCategoryName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function normalizeCategoryName(value: unknown) {
  return cleanCategoryName(value).toLocaleLowerCase('en-US');
}

export async function canonicalCategoryName(value: unknown) {
  const normalized = normalizeCategoryName(value);
  if (!normalized) return '';
  const [category] = await getDb()
    .select({ name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.normalizedName, normalized))
    .limit(1);
  return category?.name ?? '';
}
