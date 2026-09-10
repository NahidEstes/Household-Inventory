import { getDbBinding } from '@/db';
import { createSession, getAuthContext } from '@/lib/auth';
import { invitationIsActive } from '@/lib/authorization';
import { jsonError, readJsonObject, requireSafeMutation } from '@/lib/http';
import {
  cleanText,
  hashPassword,
  isValidPassword,
  recordId,
  sha256,
} from '@/lib/security-core';

type InvitationRow = {
  id: number;
  householdId: number;
  email: string;
  normalizedEmail: string;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

export async function POST(request: Request) {
  const unsafe = requireSafeMutation(request);
  if (unsafe) return unsafe;
  const body = await readJsonObject(request);
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (token.length < 30) return jsonError('Invitation link is invalid.', 400);
  const binding = getDbBinding();
  const invitation = await binding
    .prepare(
      `SELECT id, household_id AS householdId, email,
              normalized_email AS normalizedEmail, role, expires_at AS expiresAt,
              used_at AS usedAt, revoked_at AS revokedAt
       FROM household_invitations WHERE token_hash = ? LIMIT 1`,
    )
    .bind(await sha256(token))
    .first<InvitationRow>();
  if (!invitation || !invitationIsActive(invitation))
    return jsonError('Invitation is invalid, expired or already used.', 410);

  const context = await getAuthContext(request);
  let userId: number;
  let sessionCookie: string | undefined;
  if (context) {
    if (
      context.user.email.toLocaleLowerCase('en-US') !==
      invitation.normalizedEmail
    )
      return jsonError(
        'This invitation belongs to a different email address.',
        403,
      );
    userId = context.user.id;
  } else {
    const existing = await binding
      .prepare('SELECT id FROM users WHERE normalized_email = ? LIMIT 1')
      .bind(invitation.normalizedEmail)
      .first<{ id: number }>();
    if (existing)
      return Response.json(
        {
          error: 'Sign in with the invited email before accepting.',
          requiresLogin: true,
        },
        { status: 401 },
      );
    const displayName = cleanText(body?.displayName, 100);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!displayName || !isValidPassword(password))
      return jsonError(
        'Enter your name and a password of at least 12 characters.',
      );
    userId = recordId();
    await binding
      .prepare(
        `INSERT INTO users
         (id, email, normalized_email, display_name, password_hash, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      )
      .bind(
        userId,
        invitation.email,
        invitation.normalizedEmail,
        displayName,
        await hashPassword(password),
        new Date().toISOString(),
      )
      .run();
    const newSession = await createSession(
      request,
      userId,
      invitation.householdId,
    );
    sessionCookie = newSession.cookie;
  }

  const now = new Date().toISOString();
  const results = await binding.batch([
    binding
      .prepare(
        `UPDATE household_invitations SET used_at = ?
         WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
      )
      .bind(now, invitation.id, now),
    binding
      .prepare(
        `INSERT OR IGNORE INTO household_memberships
         (id, household_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(recordId(), invitation.householdId, userId, invitation.role, now),
    ...(context
      ? [
          binding
            .prepare(
              'UPDATE sessions SET selected_household_id = ? WHERE id = ?',
            )
            .bind(invitation.householdId, context.sessionId),
        ]
      : []),
  ]);
  if (!results[0].meta.changes)
    return jsonError('Invitation is invalid, expired or already used.', 410);
  return Response.json(
    { ok: true, householdId: invitation.householdId },
    { headers: sessionCookie ? { 'Set-Cookie': sessionCookie } : undefined },
  );
}
