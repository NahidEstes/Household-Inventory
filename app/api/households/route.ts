import { getDbBinding } from '@/db';
import { listUserHouseholds, requireApiContext } from '@/lib/auth';
import { jsonError, readJsonObject } from '@/lib/http';
import { cleanText, recordId } from '@/lib/security-core';

export async function GET(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  return Response.json(await listUserHouseholds(context.user.id));
}

export async function POST(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const body = await readJsonObject(request);
  const name = cleanText(body?.name, 80);
  if (name.length < 2)
    return jsonError('Household name must contain at least 2 characters.');
  const householdId = recordId();
  const now = new Date().toISOString();
  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'INSERT INTO households (id, name, created_by_user_id, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(householdId, name, context.user.id, now),
    binding
      .prepare(
        'INSERT INTO household_memberships (id, household_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(recordId(), householdId, context.user.id, 'owner', now),
    binding
      .prepare(
        'INSERT INTO household_settings (id, household_id, household_name, monthly_budget, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(recordId(), householdId, name, 30000, now),
    binding
      .prepare('UPDATE sessions SET selected_household_id = ? WHERE id = ?')
      .bind(householdId, context.sessionId),
  ]);
  return Response.json(
    { id: householdId, name, role: 'owner' },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request);
  if (context instanceof Response) return context;
  const body = await readJsonObject(request);
  const householdId = Number(body?.householdId);
  if (!Number.isInteger(householdId))
    return jsonError('A valid household is required.');
  const membership = await getDbBinding()
    .prepare(
      `SELECT h.id, h.name, hm.role
       FROM household_memberships hm
       JOIN households h ON h.id = hm.household_id
       WHERE hm.user_id = ? AND hm.household_id = ? LIMIT 1`,
    )
    .bind(context.user.id, householdId)
    .first<{ id: number; name: string; role: string }>();
  if (!membership)
    return jsonError('You do not have access to that household.', 403);
  await getDbBinding()
    .prepare('UPDATE sessions SET selected_household_id = ? WHERE id = ?')
    .bind(householdId, context.sessionId)
    .run();
  return Response.json(membership);
}
