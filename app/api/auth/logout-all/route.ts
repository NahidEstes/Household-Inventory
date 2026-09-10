import { clearSessionCookie, getAuthContext } from '@/lib/auth';
import { getDbBinding } from '@/db';
import { requireSafeMutation } from '@/lib/http';

export async function POST(request: Request) {
  const unsafe = requireSafeMutation(request);
  if (unsafe) return unsafe;
  const context = await getAuthContext(request);
  if (!context)
    return Response.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  await getDbBinding()
    .prepare(
      'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
    )
    .bind(new Date().toISOString(), context.user.id)
    .run();
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookie() } },
  );
}
