import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { householdSettings } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import { syncEssentialShopping } from '@/lib/essentials';
import { recordId } from '@/lib/security-core';

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'write');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.autoAddWhenLow !== 'boolean')
    return Response.json(
      { error: 'Choose whether to auto-add essentials.' },
      { status: 400 },
    );
  const db = getDb();
  const [existing] = await db
    .select()
    .from(householdSettings)
    .where(eq(householdSettings.householdId, context.household.id))
    .limit(1);
  if (existing) {
    await db
      .update(householdSettings)
      .set({ autoAddEssentials: body.autoAddWhenLow })
      .where(eq(householdSettings.id, existing.id));
  } else {
    await db.insert(householdSettings).values({
      id: recordId(),
      householdId: context.household.id,
      householdName: context.household.name,
      autoAddEssentials: body.autoAddWhenLow,
    });
  }
  if (body.autoAddWhenLow) await syncEssentialShopping(context.household.id);
  return Response.json({ autoAddWhenLow: body.autoAddWhenLow });
}
