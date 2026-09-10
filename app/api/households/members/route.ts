import { getDbBinding } from '@/db';
import { requireApiContext } from '@/lib/auth';
import { canChangeMembership, type HouseholdRole } from '@/lib/authorization';
import { jsonError, readJsonObject } from '@/lib/http';

type MemberRow = {
  membershipId: number;
  userId: number;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
};

export async function GET(request: Request) {
  const context = await requireApiContext(request, 'owner');
  if (context instanceof Response) return context;
  const result = await getDbBinding()
    .prepare(
      `SELECT hm.id AS membershipId, u.id AS userId, u.email,
              u.display_name AS displayName, hm.role, hm.created_at AS createdAt
       FROM household_memberships hm
       JOIN users u ON u.id = hm.user_id
       WHERE hm.household_id = ?
       ORDER BY CASE hm.role WHEN 'owner' THEN 0 WHEN 'member' THEN 1 ELSE 2 END,
                u.email COLLATE NOCASE`,
    )
    .bind(context.household.id)
    .all<MemberRow>();
  return Response.json(result.results);
}

export async function PATCH(request: Request) {
  const context = await requireApiContext(request, 'owner');
  if (context instanceof Response) return context;
  const body = await readJsonObject(request);
  const membershipId = Number(body?.membershipId);
  const role = typeof body?.role === 'string' ? body.role : '';
  if (
    !Number.isInteger(membershipId) ||
    !['owner', 'member', 'viewer'].includes(role)
  )
    return jsonError('A valid member and role are required.');
  const binding = getDbBinding();
  const membership = await binding
    .prepare(
      'SELECT id, user_id AS userId, role FROM household_memberships WHERE id = ? AND household_id = ? LIMIT 1',
    )
    .bind(membershipId, context.household.id)
    .first<{ id: number; userId: number; role: string }>();
  if (!membership) return jsonError('Member not found.', 404);
  if (
    !canChangeMembership({
      actorUserId: context.user.id,
      targetUserId: membership.userId,
      targetRole: membership.role as HouseholdRole,
      nextRole: role as HouseholdRole,
      ownerCount: await ownerCount(context.household.id),
    })
  )
    return jsonError(
      'You cannot demote yourself or the last household owner.',
      409,
    );
  await binding
    .prepare(
      'UPDATE household_memberships SET role = ? WHERE id = ? AND household_id = ?',
    )
    .bind(role, membershipId, context.household.id)
    .run();
  return Response.json({ membershipId, role });
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'owner');
  if (context instanceof Response) return context;
  const membershipId = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(membershipId))
    return jsonError('A valid member is required.');
  const binding = getDbBinding();
  const membership = await binding
    .prepare(
      'SELECT id, user_id AS userId, role FROM household_memberships WHERE id = ? AND household_id = ? LIMIT 1',
    )
    .bind(membershipId, context.household.id)
    .first<{ id: number; userId: number; role: string }>();
  if (!membership) return jsonError('Member not found.', 404);
  if (
    !canChangeMembership({
      actorUserId: context.user.id,
      targetUserId: membership.userId,
      targetRole: membership.role as HouseholdRole,
      ownerCount: await ownerCount(context.household.id),
      removing: true,
    })
  )
    return jsonError(
      'You cannot remove yourself or the last household owner.',
      409,
    );
  await binding
    .prepare('DELETE FROM household_memberships WHERE id = ?')
    .bind(membershipId)
    .run();
  return Response.json({ id: membershipId });
}

async function ownerCount(householdId: number) {
  const row = await getDbBinding()
    .prepare(
      "SELECT COUNT(*) AS count FROM household_memberships WHERE household_id = ? AND role = 'owner'",
    )
    .bind(householdId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}
