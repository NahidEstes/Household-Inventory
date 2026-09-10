import { getDbBinding } from '@/db';
import { requireApiContext } from '@/lib/auth';
import { jsonError, readJsonObject } from '@/lib/http';
import {
  isValidEmail,
  normalizeEmail,
  randomToken,
  recordId,
  sha256,
} from '@/lib/security-core';

type InvitationRow = {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export async function GET(request: Request) {
  const context = await requireApiContext(request, 'owner');
  if (context instanceof Response) return context;
  const result = await getDbBinding()
    .prepare(
      `SELECT id, email, role, expires_at AS expiresAt, used_at AS usedAt,
              revoked_at AS revokedAt, created_at AS createdAt
       FROM household_invitations
       WHERE household_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(context.household.id)
    .all<InvitationRow>();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  const context = await requireApiContext(request, 'owner');
  if (context instanceof Response) return context;
  const body = await readJsonObject(request);
  const email = normalizeEmail(body?.email);
  const role = typeof body?.role === 'string' ? body.role : '';
  if (!isValidEmail(email) || !['member', 'viewer'].includes(role))
    return jsonError('Enter a valid email and invitation role.');
  const binding = getDbBinding();
  const existingMember = await binding
    .prepare(
      `SELECT hm.id FROM household_memberships hm
       JOIN users u ON u.id = hm.user_id
       WHERE hm.household_id = ? AND u.normalized_email = ? LIMIT 1`,
    )
    .bind(context.household.id, email)
    .first();
  if (existingMember)
    return jsonError('That person is already a household member.', 409);
  const activeInvitation = await binding
    .prepare(
      `SELECT id FROM household_invitations
       WHERE household_id = ? AND normalized_email = ?
         AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ? LIMIT 1`,
    )
    .bind(context.household.id, email, new Date().toISOString())
    .first();
  if (activeInvitation)
    return jsonError(
      'An active invitation already exists for this email.',
      409,
    );
  const token = randomToken();
  const id = recordId();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await binding
    .prepare(
      `INSERT INTO household_invitations
       (id, household_id, email, normalized_email, role, token_hash,
        invited_by_user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      context.household.id,
      email,
      email,
      role,
      await sha256(token),
      context.user.id,
      expiresAt,
      now.toISOString(),
    )
    .run();
  return Response.json(
    {
      id,
      email,
      role,
      expiresAt,
      invitationUrl: `${new URL(request.url).origin}/invite/${token}`,
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const context = await requireApiContext(request, 'owner');
  if (context instanceof Response) return context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id))
    return jsonError('A valid invitation is required.');
  const result = await getDbBinding()
    .prepare(
      `UPDATE household_invitations SET revoked_at = ?
       WHERE id = ? AND household_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
    )
    .bind(new Date().toISOString(), id, context.household.id)
    .run();
  if (!result.meta.changes)
    return jsonError('Active invitation not found.', 404);
  return Response.json({ id });
}
