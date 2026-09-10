import { env } from 'cloudflare:workers';
import { getDbBinding } from '@/db';
import { roleAllows, type HouseholdRole } from '@/lib/authorization';
import {
  SESSION_TTL_SECONDS,
  hasSafeRequestOrigin,
  randomToken,
  recordId,
  sha256,
} from '@/lib/security-core';

export type AuthContext = {
  sessionId: number;
  sessionToken: string;
  user: {
    id: number;
    email: string;
    displayName: string | null;
  };
  household: {
    id: number;
    name: string;
    role: HouseholdRole;
  };
};

type SessionRow = {
  sessionId: number;
  userId: number;
  email: string;
  displayName: string | null;
  userStatus: string;
  selectedHouseholdId: number | null;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string;
};

type HouseholdRow = { id: number; name: string; role: HouseholdRole };

export const SESSION_COOKIE = 'homely_session';

export async function getAuthContext(
  request: Request,
): Promise<AuthContext | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const binding = getDbBinding();
  const row = await binding
    .prepare(
      `SELECT s.id AS sessionId, s.user_id AS userId, u.email,
              u.display_name AS displayName, u.status AS userStatus,
              s.selected_household_id AS selectedHouseholdId,
              s.expires_at AS expiresAt, s.revoked_at AS revokedAt,
              s.last_seen_at AS lastSeenAt
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<SessionRow>();
  if (
    !row ||
    row.userStatus !== 'active' ||
    row.revokedAt ||
    Date.parse(row.expiresAt) <= Date.now()
  )
    return null;

  let household = row.selectedHouseholdId
    ? await membershipFor(row.userId, row.selectedHouseholdId)
    : null;
  if (!household) {
    household = await binding
      .prepare(
        `SELECT h.id, h.name, hm.role
         FROM household_memberships hm
         JOIN households h ON h.id = hm.household_id
         WHERE hm.user_id = ?
         ORDER BY hm.created_at, hm.id
         LIMIT 1`,
      )
      .bind(row.userId)
      .first<HouseholdRow>();
    if (!household) return null;
    await binding
      .prepare('UPDATE sessions SET selected_household_id = ? WHERE id = ?')
      .bind(household.id, row.sessionId)
      .run();
  }

  if (Date.now() - Date.parse(row.lastSeenAt) > 60 * 60 * 1000)
    await binding
      .prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), row.sessionId)
      .run();

  return {
    sessionId: row.sessionId,
    sessionToken: token,
    user: { id: row.userId, email: row.email, displayName: row.displayName },
    household,
  };
}

export async function requireApiContext(
  request: Request,
  permission: 'read' | 'write' | 'owner' = 'read',
): Promise<AuthContext | Response> {
  const context = await getAuthContext(request);
  if (!context)
    return Response.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  if (
    request.method !== 'GET' &&
    request.method !== 'HEAD' &&
    !hasSafeRequestOrigin(request)
  )
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!roleAllows(context.household.role, permission))
    return Response.json(
      {
        error:
          permission === 'owner'
            ? 'Owner access is required.'
            : 'This household is read-only for your account.',
      },
      { status: 403 },
    );
  return context;
}

export async function listUserHouseholds(userId: number) {
  const result = await getDbBinding()
    .prepare(
      `SELECT h.id, h.name, hm.role
       FROM household_memberships hm
       JOIN households h ON h.id = hm.household_id
       WHERE hm.user_id = ?
       ORDER BY CASE hm.role WHEN 'owner' THEN 0 WHEN 'member' THEN 1 ELSE 2 END,
                h.name COLLATE NOCASE`,
    )
    .bind(userId)
    .all<HouseholdRow>();
  return result.results;
}

export async function membershipFor(userId: number, householdId: number) {
  return getDbBinding()
    .prepare(
      `SELECT h.id, h.name, hm.role
       FROM household_memberships hm
       JOIN households h ON h.id = hm.household_id
       WHERE hm.user_id = ? AND hm.household_id = ?
       LIMIT 1`,
    )
    .bind(userId, householdId)
    .first<HouseholdRow>();
}

export async function createSession(
  request: Request,
  userId: number,
  selectedHouseholdId: number,
) {
  const session = await prepareSession(request, userId, selectedHouseholdId);
  await getDbBinding()
    .prepare(
      `INSERT INTO sessions
       (id, token_hash, user_id, selected_household_id, expires_at, last_seen_at, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      session.id,
      session.tokenHash,
      session.userId,
      session.selectedHouseholdId,
      session.expiresAt,
      session.lastSeenAt,
      session.userAgent,
    )
    .run();
  return session;
}

export async function prepareSession(
  request: Request,
  userId: number,
  selectedHouseholdId: number,
) {
  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_TTL_SECONDS * 1000,
  ).toISOString();
  return {
    id: recordId(),
    token,
    tokenHash: await sha256(token),
    userId,
    selectedHouseholdId,
    expiresAt,
    lastSeenAt: now.toISOString(),
    userAgent: request.headers.get('user-agent')?.slice(0, 240) ?? null,
    cookie: sessionCookie(token, SESSION_TTL_SECONDS),
  };
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function sessionCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function readSessionToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer '))
    return authorization.slice(7).trim();
  const cookies = request.headers.get('cookie') ?? '';
  for (const part of cookies.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join('='));
  }
  return '';
}

export function bootstrapSecret() {
  return typeof env.BOOTSTRAP_TOKEN === 'string' ? env.BOOTSTRAP_TOKEN : '';
}

export async function isLoginAllowed(
  request: Request,
  normalizedEmail: string,
) {
  const keyHash = await loginRateKey(request, normalizedEmail);
  const row = await getDbBinding()
    .prepare(
      'SELECT attempts, window_started_at AS windowStartedAt, blocked_until AS blockedUntil FROM auth_rate_limits WHERE key_hash = ?',
    )
    .bind(keyHash)
    .first<{
      attempts: number;
      windowStartedAt: string;
      blockedUntil: string | null;
    }>();
  return !row?.blockedUntil || Date.parse(row.blockedUntil) <= Date.now();
}

export async function recordLoginFailure(
  request: Request,
  normalizedEmail: string,
) {
  const keyHash = await loginRateKey(request, normalizedEmail);
  const binding = getDbBinding();
  const now = new Date();
  const row = await binding
    .prepare(
      'SELECT attempts, window_started_at AS windowStartedAt FROM auth_rate_limits WHERE key_hash = ?',
    )
    .bind(keyHash)
    .first<{ attempts: number; windowStartedAt: string }>();
  const windowExpired =
    !row || Date.now() - Date.parse(row.windowStartedAt) > 15 * 60 * 1000;
  const attempts = windowExpired ? 1 : row.attempts + 1;
  const blockedUntil =
    attempts >= 5
      ? new Date(now.getTime() + 15 * 60 * 1000).toISOString()
      : null;
  await binding
    .prepare(
      `INSERT INTO auth_rate_limits (key_hash, attempts, window_started_at, blocked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key_hash) DO UPDATE SET attempts = excluded.attempts,
         window_started_at = excluded.window_started_at,
         blocked_until = excluded.blocked_until, updated_at = excluded.updated_at`,
    )
    .bind(
      keyHash,
      attempts,
      windowExpired ? now.toISOString() : row.windowStartedAt,
      blockedUntil,
      now.toISOString(),
    )
    .run();
}

export async function clearLoginFailures(
  request: Request,
  normalizedEmail: string,
) {
  await getDbBinding()
    .prepare('DELETE FROM auth_rate_limits WHERE key_hash = ?')
    .bind(await loginRateKey(request, normalizedEmail))
    .run();
}

async function loginRateKey(request: Request, normalizedEmail: string) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown';
  return sha256(`login:${ip}:${normalizedEmail}`);
}
