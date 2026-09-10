import { eq } from 'drizzle-orm';
import { getDb, getDbBinding } from '@/db';
import { householdSettings } from '@/db/schema';
import { requireApiContext } from '@/lib/auth';
import { recordId } from '@/lib/security-core';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const [settings] = await getDb()
    .select()
    .from(householdSettings)
    .where(eq(householdSettings.householdId, context.household.id));
  return Response.json(
    settings ?? {
      id: 0,
      householdId: context.household.id,
      householdName: context.household.name,
      monthlyBudget: 30000,
    },
  );
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'owner');
  if (context instanceof Response) return context;
  const body = (await request.json()) as Record<string, unknown>;
  const householdName =
    typeof body.householdName === 'string'
      ? body.householdName.trim().slice(0, 80)
      : '';
  const monthlyBudget = Number(body.monthlyBudget);
  if (
    householdName.length < 2 ||
    !Number.isFinite(monthlyBudget) ||
    monthlyBudget <= 0
  )
    return Response.json(
      { error: 'Please provide valid household settings.' },
      { status: 400 },
    );
  const binding = getDbBinding();
  const existing = await binding
    .prepare('SELECT id FROM household_settings WHERE household_id = ? LIMIT 1')
    .bind(context.household.id)
    .first<{ id: number }>();
  const now = new Date().toISOString();
  const settingsId = existing?.id ?? recordId();
  await binding.batch([
    existing
      ? binding
          .prepare(
            'UPDATE household_settings SET household_name = ?, monthly_budget = ?, updated_at = ? WHERE id = ? AND household_id = ?',
          )
          .bind(
            householdName,
            monthlyBudget,
            now,
            existing.id,
            context.household.id,
          )
      : binding
          .prepare(
            'INSERT INTO household_settings (id, household_id, household_name, monthly_budget, updated_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(
            settingsId,
            context.household.id,
            householdName,
            monthlyBudget,
            now,
          ),
    binding
      .prepare('UPDATE households SET name = ? WHERE id = ?')
      .bind(householdName, context.household.id),
  ]);
  return Response.json({
    id: settingsId,
    householdId: context.household.id,
    householdName,
    monthlyBudget,
  });
}
