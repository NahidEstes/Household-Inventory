import { getDbBinding } from '@/db';
import { bootstrapSecret, createSession } from '@/lib/auth';
import { jsonError, readJsonObject, requireSafeMutation } from '@/lib/http';
import {
  cleanText,
  constantTimeTextEqual,
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  recordId,
} from '@/lib/security-core';

export async function GET() {
  const row = await getDbBinding()
    .prepare('SELECT COUNT(*) AS count FROM users')
    .first<{ count: number }>();
  return Response.json({
    required: Number(row?.count ?? 0) === 0,
    configured: Boolean(bootstrapSecret()),
  });
}

export async function POST(request: Request) {
  const unsafe = requireSafeMutation(request);
  if (unsafe) return unsafe;
  const body = await readJsonObject(request);
  if (!body) return jsonError('Invalid request.');
  const configuredSecret = bootstrapSecret();
  const providedSecret =
    typeof body.bootstrapToken === 'string' ? body.bootstrapToken : '';
  if (!configuredSecret)
    return jsonError('Owner setup is not configured.', 503);
  if (
    !providedSecret ||
    !constantTimeTextEqual(providedSecret, configuredSecret)
  )
    return jsonError('Owner setup token is invalid.', 403);
  const binding = getDbBinding();
  const count = await binding
    .prepare('SELECT COUNT(*) AS count FROM users')
    .first<{ count: number }>();
  if (Number(count?.count ?? 0) > 0)
    return jsonError('Owner setup is no longer available.', 409);
  const email = normalizeEmail(body.email);
  const displayName = cleanText(body.displayName, 100);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!isValidEmail(email) || !displayName || !isValidPassword(password))
    return jsonError(
      'Enter a valid name, email and a password of at least 12 characters.',
    );

  const userId = recordId();
  const household = await binding
    .prepare('SELECT id, name FROM households ORDER BY id LIMIT 1')
    .first<{ id: number; name: string }>();
  const householdId = household?.id ?? 1;
  const now = new Date().toISOString();
  try {
    await binding.batch([
      binding
        .prepare(
          'INSERT OR IGNORE INTO households (id, name, created_at) VALUES (?, ?, ?)',
        )
        .bind(householdId, household?.name || `${displayName}’s Home`, now),
      binding
        .prepare(
          `INSERT INTO users (id, email, normalized_email, display_name, password_hash, status, created_at)
           SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
        )
        .bind(
          userId,
          email,
          email,
          displayName,
          await hashPassword(password),
          'active',
          now,
        ),
      binding
        .prepare(
          'INSERT INTO household_memberships (id, household_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(recordId(), householdId, userId, 'owner', now),
      binding
        .prepare(
          'UPDATE households SET created_by_user_id = COALESCE(created_by_user_id, ?) WHERE id = ?',
        )
        .bind(userId, householdId),
    ]);
  } catch {
    return jsonError('Owner setup is no longer available.', 409);
  }
  const session = await createSession(request, userId, householdId);
  return Response.json(
    { ok: true },
    { status: 201, headers: { 'Set-Cookie': session.cookie } },
  );
}
