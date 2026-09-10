import { getDbBinding } from '@/db';
import { getAuthContext } from '@/lib/auth';
import { jsonError, readJsonObject, requireSafeMutation } from '@/lib/http';
import {
  hashPassword,
  isValidPassword,
  verifyPassword,
} from '@/lib/security-core';

export async function POST(request: Request) {
  const unsafe = requireSafeMutation(request);
  if (unsafe) return unsafe;
  const context = await getAuthContext(request);
  if (!context) return jsonError('Authentication required.', 401);
  const body = await readJsonObject(request);
  const currentPassword =
    typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword =
    typeof body?.newPassword === 'string' ? body.newPassword : '';
  if (!isValidPassword(newPassword))
    return jsonError('New password must contain 12 to 128 characters.');
  const row = await getDbBinding()
    .prepare(
      'SELECT password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1',
    )
    .bind(context.user.id)
    .first<{ passwordHash: string }>();
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash)))
    return jsonError('Current password is incorrect.', 401);
  const now = new Date().toISOString();
  const binding = getDbBinding();
  await binding.batch([
    binding
      .prepare(
        'UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?',
      )
      .bind(await hashPassword(newPassword), now, context.user.id),
    binding
      .prepare(
        'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL',
      )
      .bind(now, context.user.id, context.sessionId),
  ]);
  return Response.json({ ok: true });
}
