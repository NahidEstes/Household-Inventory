import { getDbBinding } from '@/db';
import {
  clearLoginFailures,
  createSession,
  isLoginAllowed,
  recordLoginFailure,
} from '@/lib/auth';
import { jsonError, readJsonObject, requireSafeMutation } from '@/lib/http';
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  verifyPassword,
} from '@/lib/security-core';

type UserRow = { id: number; passwordHash: string; status: string };

// Native clients exchange credentials for a bearer token and should keep it in
// platform-protected storage. Browser clients use the HttpOnly cookie login.
export async function POST(request: Request) {
  const unsafe = requireSafeMutation(request);
  if (unsafe) return unsafe;
  const body = await readJsonObject(request);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  const genericError = () => jsonError('Email or password is incorrect.', 401);
  if (!isValidEmail(email) || !password || password.length > 128)
    return genericError();
  if (!(await isLoginAllowed(request, email)))
    return jsonError('Too many attempts. Please try again later.', 429);

  const binding = getDbBinding();
  const user = await binding
    .prepare(
      'SELECT id, password_hash AS passwordHash, status FROM users WHERE normalized_email = ? LIMIT 1',
    )
    .bind(email)
    .first<UserRow>();
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : Boolean(await hashPassword(password)) && false;
  if (!user || user.status !== 'active' || !valid) {
    await recordLoginFailure(request, email);
    return genericError();
  }
  const membership = await binding
    .prepare(
      'SELECT household_id AS householdId FROM household_memberships WHERE user_id = ? ORDER BY created_at, id LIMIT 1',
    )
    .bind(user.id)
    .first<{ householdId: number }>();
  if (!membership) return genericError();
  await clearLoginFailures(request, email);
  const session = await createSession(request, user.id, membership.householdId);
  return Response.json({
    accessToken: session.token,
    tokenType: 'Bearer',
    expiresAt: session.expiresAt,
  });
}
