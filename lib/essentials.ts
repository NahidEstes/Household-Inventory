import { getDbBinding } from '@/db';
import { AUTO_ADD_ESSENTIALS_SQL } from '@/lib/essentials-sql';

// Called after stock changes. Stock remains authoritative in inventory_items;
// this only creates a missing, active shopping reminder when both switches are on.
export async function syncEssentialShopping(householdId: number) {
  const db = getDbBinding();
  await db.prepare(AUTO_ADD_ESSENTIALS_SQL).bind(householdId).run();
}
