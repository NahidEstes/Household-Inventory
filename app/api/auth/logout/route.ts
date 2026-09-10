import { clearSessionCookie, getAuthContext } from '@/lib/auth';
import { getDbBinding } from '@/db';
import { requireSafeMutation } from '@/lib/http';

export async function POST(request: Request) {
  const unsafe = requireSafeMutation(request);
  if (unsafe) return unsafe;
  const context = await getAuthContext(request);
  if (context)
    await getDbBinding()
      .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), context.sessionId)
      .run();
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookie() } },
  );
}
