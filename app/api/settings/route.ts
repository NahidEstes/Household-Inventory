import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { householdSettings } from '@/db/schema';

const defaults = { id: 1, householdName: 'My Household', monthlyBudget: 30000 };

export async function GET() {
  const [settings] = await getDb()
    .select()
    .from(householdSettings)
    .where(eq(householdSettings.id, 1));
  return Response.json(settings ?? defaults);
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const householdName =
    typeof body.householdName === 'string' ? body.householdName.trim() : '';
  const monthlyBudget = Number(body.monthlyBudget);
  if (!householdName || !Number.isFinite(monthlyBudget) || monthlyBudget <= 0) {
    return Response.json(
      { error: 'Please provide valid household settings.' },
      { status: 400 },
    );
  }
  await getDb()
    .insert(householdSettings)
    .values({ id: 1, householdName, monthlyBudget })
    .onConflictDoUpdate({
      target: householdSettings.id,
      set: {
        householdName,
        monthlyBudget,
        updatedAt: new Date().toISOString(),
      },
    });
  return Response.json({ id: 1, householdName, monthlyBudget });
}
