import { hasSafeRequestOrigin } from '@/lib/security-core';

export async function readJsonObject(request: Request) {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .includes('application/json')
  )
    return null;
  try {
    const value = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function requireSafeMutation(request: Request) {
  return hasSafeRequestOrigin(request)
    ? null
    : Response.json({ error: 'Invalid request origin.' }, { status: 403 });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
