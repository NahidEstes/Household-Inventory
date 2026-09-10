import { getAuthContext, listUserHouseholds } from '@/lib/auth';

export async function GET(request: Request) {
  const context = await getAuthContext(request);
  if (!context)
    return Response.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  return Response.json({
    user: context.user,
    household: context.household,
    households: await listUserHouseholds(context.user.id),
  });
}
